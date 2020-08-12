import arrayifyStream from 'arrayify-stream';
import { ConflictHttpError } from '../util/errors/ConflictHttpError';
import fsPromises from 'fs/promises';
import { contentType as getContentTypeFromExtension } from 'mime-types';
import { InteractionController } from '../util/InteractionController';
import { MethodNotAllowedHttpError } from '../util/errors/MethodNotAllowedHttpError';
import { NotFoundHttpError } from '../util/errors/NotFoundHttpError';
import { Readable } from 'stream';
import { Representation } from '../ldp/representation/Representation';
import { RepresentationMetadata } from '../ldp/representation/RepresentationMetadata';
import { ResourceIdentifier } from '../ldp/representation/ResourceIdentifier';
import { ResourceStore } from './ResourceStore';
import streamifyArray from 'streamify-array';
import { UnsupportedMediaTypeHttpError } from '../util/errors/UnsupportedMediaTypeHttpError';
import { createReadStream, createWriteStream, Stats } from 'fs';
import { DATA_TYPE_BINARY, DATA_TYPE_QUAD } from '../util/ContentTypes';
import { DataFactory, StreamParser, StreamWriter } from 'n3';
import { ensureTrailingSlash, trimTrailingSlashes } from '../util/Util';
import { LDP, RDF, STAT, TERMS, XML } from '../util/Prefixes';
import { NamedNode, Quad } from 'rdf-js';

/**
 * Resource store storing its data in the file system backend.
 * All requests will throw an {@link NotFoundHttpError} if unknown identifiers get passed.
 */
export class FileResourceStore implements ResourceStore {
  private readonly baseRequestURI: string;
  private readonly rootFilepath: string;
  private readonly interactionController: InteractionController;

  private readonly predicates = {
    aType: DataFactory.namedNode(`${RDF}type`),
    modified: DataFactory.namedNode(`${TERMS}modified`),
    contains: DataFactory.namedNode(`${LDP}contains`),
    mtime: DataFactory.namedNode(`${STAT}mtime`),
    size: DataFactory.namedNode(`${STAT}size`),
  };

  private readonly objects = {
    container: DataFactory.namedNode(`${LDP}Container`),
    basicContainer: DataFactory.namedNode(`${LDP}BasicContainer`),
    ldpResource: DataFactory.namedNode(`${LDP}Resource`),
    dateTime: DataFactory.namedNode(`${XML}dateTime`),
  };

  /**
   * @param baseRequestURI - Will be stripped of all incoming URIs and added to all outgoing ones to find the relative
   * path.
   * @param rootFilepath - Root filepath in which the resources and containers will be saved as files and directories.
   * @param interactionController - Instance of InteractionController to use.
   */
  public constructor(baseRequestURI: string, rootFilepath: string, interactionController: InteractionController) {
    this.baseRequestURI = trimTrailingSlashes(baseRequestURI);
    this.rootFilepath = trimTrailingSlashes(rootFilepath);
    this.interactionController = interactionController;
  }

  /**
   * Store the incoming data as a file under a file path corresponding to `container.path`,
   * where slashes correspond to subdirectories.
   * @param container - The identifier to store the new data under.
   * @param representation - Data to store. Only File streams are supported.
   *
   * @returns The newly generated identifier.
   */
  public async addResource(container: ResourceIdentifier, representation: Representation): Promise<ResourceIdentifier> {
    if (representation.dataType !== DATA_TYPE_BINARY) {
      throw new UnsupportedMediaTypeHttpError('FileResourceStore only supports binary representations.');
    }
    const path = this.parseIdentifier(container);
    const { slug, raw } = representation.metadata;
    const linkTypes = representation.metadata.linkRel?.type;
    let metadata;
    if (raw.length > 0) {
      metadata = streamifyArray(raw).pipe(new StreamWriter({ format: 'text/turtle' }));
    }

    const parentContainer = this.interactionController.getContainer(path);
    const isContainer = this.interactionController.isContainer(slug, linkTypes);
    const newIdentifier = this.interactionController.generateIdentifier(isContainer, slug);
    if (!isContainer) {
      // Create a file for the resource with as filepath the parent container.
      return this.createFile(parentContainer, newIdentifier, representation.data, path.endsWith('/'), metadata);
    }

    // Create a new container as subdirectory of the parent container.
    return this.createContainer(parentContainer, newIdentifier, path.endsWith('/'), metadata);
  }

  /**
   * Deletes the given resource.
   * @param identifier - Identifier of resource to delete.
   */
  public async deleteResource(identifier: ResourceIdentifier): Promise<void> {
    let path = this.parseIdentifier(identifier);
    if (path === '' || ensureTrailingSlash(path) === '/') {
      throw new MethodNotAllowedHttpError('Cannot delete rootFilepath container.');
    }
    path = `${this.rootFilepath}${path}`;
    try {
      const stats = await fsPromises.lstat(path);
      if (stats.isFile()) {
        await fsPromises.unlink(path);
        try {
          await fsPromises.unlink(`${path}.metadata`);
        } catch (_) {
          // It's ok if there was no metadata file.
        }
      } else if (stats.isDirectory()) {
        path = ensureTrailingSlash(path);
        const files = await fsPromises.readdir(path);
        let match = files.find((file): any => !file.startsWith('.metadata'));
        if (match !== undefined) {
          throw new ConflictHttpError('Container is not empty.');
        }

        match = files.find((file): any => file.startsWith('.metadata'));
        while (match) {
          await fsPromises.unlink(`${path}${match}`);
          const matchedFile = match;
          files.filter((file): any => file !== matchedFile);
          match = files.find((file): any => file.startsWith('.metadata'));
        }

        await fsPromises.rmdir(path);
      } else {
        throw new NotFoundHttpError();
      }
    } catch (error) {
      if (error instanceof ConflictHttpError) {
        throw new ConflictHttpError('Container is not empty.');
      }
      throw new NotFoundHttpError();
    }
  }

  /**
   * Returns the stored representation for the given identifier.
   * No preferences are supported.
   * @param identifier - Identifier to retrieve.
   *
   * @returns The corresponding Representation.
   */
  public async getRepresentation(identifier: ResourceIdentifier): Promise<Representation> {
    let path = `${this.rootFilepath}${this.parseIdentifier(identifier)}`;
    return new Promise(async(resolve, reject): Promise<any> => {
      try {
        const stats = await fsPromises.lstat(path);
        if (stats.isFile()) {
          const readStream = createReadStream(path);
          const contentType = getContentTypeFromExtension(path);
          let rawMetadata: Quad[] = [];
          try {
            const readMetadataStream = createReadStream(`${path}.metadata`);
            rawMetadata = await arrayifyStream(readMetadataStream.pipe(new StreamParser({ format: 'text/turtle' })));
          } catch (_) {
            // Metadata file doesn't exist so lets keep `rawMetaData` an empty array.
          }
          const metadata: RepresentationMetadata = {
            raw: rawMetadata,
            profiles: [],
            dateTime: stats.mtime,
            byteSize: stats.size,
          };
          if (contentType && contentType !== path) {
            metadata.contentType = contentType;
          }
          resolve({ metadata, data: readStream, dataType: DATA_TYPE_BINARY });
        } else if (stats.isDirectory()) {
          path = ensureTrailingSlash(path);
          const files = await fsPromises.readdir(path);
          const quads: Quad[] = [];

          const containerSubj: NamedNode = DataFactory.namedNode(path);

          quads.push(...this.generateResourceQuads(containerSubj, stats));

          for (const childName of files) {
            try {
              const childSubj: NamedNode = DataFactory.namedNode(`${path}${childName}`);
              const childStats = await fsPromises.lstat(path + childName);
              if (!childStats.isFile() && !childStats.isDirectory()) {
                continue;
              }

              quads.push(DataFactory.quad(containerSubj, this.predicates.contains, childSubj));
              quads.push(...this.generateResourceQuads(childSubj, childStats));
            } catch (_) {
              // Skip the child if there is an error.
            }
          }
          let rawMetadata: Quad[] = [];
          try {
            const readMetadataStream = createReadStream(`${path}.metadata`);
            rawMetadata = await arrayifyStream(readMetadataStream);
          } catch (_) {
            // Metadata file doesn't exist so lets keep `rawMetaData` an empty array.
          }

          resolve({
            dataType: DATA_TYPE_QUAD,
            data: streamifyArray(quads),
            metadata: {
              raw: rawMetadata,
              profiles: [],
              dateTime: stats.mtime,
            },
          });
        } else {
          reject(new ConflictHttpError('Not a valid resource.'));
        }
      } catch (error) {
        reject(new NotFoundHttpError());
      }
    });
  }

  /**
   * @throws Not supported.
   */
  public async modifyResource(): Promise<void> {
    throw new Error('Not supported.');
  }

  /**
   * Replaces the stored Representation with the new one for the given identifier.
   * @param identifier - Identifier to replace.
   * @param representation - New Representation.
   */
  public async setRepresentation(identifier: ResourceIdentifier, representation: Representation): Promise<void> {
    if (representation.dataType !== DATA_TYPE_BINARY) {
      throw new UnsupportedMediaTypeHttpError('FileResourceStore only supports binary representations.');
    }
    const [ , path, slug ] = /(?<path>.*\/)(?<slug>[^/]*\/?)/u.exec(this.parseIdentifier(identifier)) ?? [];
    const { raw } = representation.metadata;
    const linkTypes = representation.metadata.linkRel?.type;
    let metadata: Readable | undefined;
    if (raw && raw.length > 0) {
      metadata = streamifyArray(raw);
    }

    const parentContainer = this.interactionController.getContainer(path);
    const isContainer = this.interactionController.isContainer(slug, linkTypes);
    const newIdentifier = this.interactionController.generateIdentifier(isContainer, slug);
    if (!isContainer) {
      // (Re)write file for the resource if no container with that identifier exists.
      return new Promise(async(resolve, reject): Promise<any> => {
        try {
          const stats = await fsPromises.lstat(
            `${this.rootFilepath}${parentContainer}${newIdentifier}`,
          );
          if (stats.isFile()) {
            await this.createFile(parentContainer,
              newIdentifier,
              representation.data,
              true,
              metadata).then((): any => resolve()).catch((error): any => {
              reject(error);
            });
          } else {
            reject(new ConflictHttpError('Container with that identifier already exists.'));
          }
        } catch (error) {
          await this.createFile(parentContainer,
            newIdentifier,
            representation.data,
            true,
            metadata).then((): any => resolve()).catch((error_): any => {
            reject(error_);
          });
        }
      });
    }

    // Create a container if the identifier doesn't exist yet.
    return new Promise(async(resolve, reject): Promise<any> => {
      try {
        await fsPromises.access(
          `${this.rootFilepath}${parentContainer}${newIdentifier}`,
        );
        reject(new ConflictHttpError('Resource with that identifier already exists.'));
      } catch (error) {
        // Identifier doesn't exist yet so we can create a container.
        await this.createContainer(parentContainer,
          newIdentifier,
          true,
          metadata)
          .then((): any => resolve())
          .catch((error_): any => {
            reject(error_);
          });
      }
    });
  }

  /**
   * Strips the baseRequestURI from the identifier and checks if the stripped base URI matches the store's one.
   * @param identifier - Incoming identifier.
   *
   * @throws {@link NotFoundHttpError}
   * If the identifier does not match the baseRequestURI path of the store.
   */
  private parseIdentifier(identifier: ResourceIdentifier): string {
    if (!identifier.path.startsWith(this.baseRequestURI)) {
      throw new NotFoundHttpError();
    }
    return identifier.path.slice(this.baseRequestURI.length);
  }

  /**
   * Strips the rootFilepath path from the filepath and adds the baseRequestURI in front of it.
   * @param path - The filepath.
   *
   * @throws {@Link Error}
   * If the filepath does not match the rootFilepath path of the store.
   */
  private mapFilepathToUrl(path: string): string {
    if (!path.startsWith(this.rootFilepath)) {
      throw new Error('Cannot map filepath to URL.');
    }
    return this.baseRequestURI + path.slice(this.rootFilepath.length);
  }

  /**
   * Create a file to represent a resource.
   * @param path - The path to the directory in which the file should be created.
   * @param resourceName - The name of the file to be created.
   * @param data - The data to be put in the file.
   * @param allowRecursiveCreation - Whether necessary but not existing intermediate containers may be created.
   * @param metadata - Optional metadata that will be stored at `path/resourceName.metadata` if set.
   *
   * @returns Promise of the identifier of the newly created resource.
   */
  private async createFile(path: string, resourceName: string, data: Readable,
    allowRecursiveCreation: boolean, metadata?: Readable): Promise<ResourceIdentifier> {
    if (allowRecursiveCreation) {
      await this.createContainer(path, '', true);
    }
    return new Promise(async(resolve, reject): Promise<any> => {
      try {
        const stats = await fsPromises.lstat(`${this.rootFilepath}${path}`);
        if (!stats.isDirectory()) {
          reject(new MethodNotAllowedHttpError('The given path is not a valid container.'));
        } else {
          if (metadata) {
            try {
              await this.createDataFile(`${this.rootFilepath}${path}${resourceName}.metadata`, metadata);
            } catch (error) {
              reject(error);
              return;
            }
          }
          try {
            await this.createDataFile(this.rootFilepath + path + resourceName, data);
            resolve({ path: this.mapFilepathToUrl(this.rootFilepath + path + resourceName) });
          } catch (error) {
            // Normal file has not been created so we don't want the metadata file to remain.
            await fsPromises.unlink(`${this.rootFilepath}${path}${resourceName}.metadata`);
            reject(error);
            return;
          }
        }
      } catch (error) {
        reject(new MethodNotAllowedHttpError());
      }
    });
  }

  /**
   * Create a directory to represent a container.
   * @param path - The path to the parent directory in which the new directory should be created.
   * @param containerName - The name of the directory to be created.
   * @param allowRecursiveCreation - Whether necessary but not existing intermediate containers may be created.
   * @param metadata - Optional metadata that will be stored at `path/_containerName/.metadata` if set.
   *
   * @returns Promise of the identifier of the newly created container.
   */
  private async createContainer(path: string, containerName: string,
    allowRecursiveCreation: boolean, metadata?: Readable): Promise<ResourceIdentifier> {
    const fullPath = ensureTrailingSlash(this.rootFilepath + path + containerName);
    return new Promise(async(resolve, reject): Promise<any> => {
      try {
        if (!allowRecursiveCreation) {
          const stats = await fsPromises.lstat(this.rootFilepath + path);
          if (!stats.isDirectory()) {
            reject(new MethodNotAllowedHttpError('The given path is not a valid container.'));
            return;
          }
        }
        await fsPromises.mkdir(fullPath, { recursive: allowRecursiveCreation });
        if (metadata) {
          try {
            await this.createDataFile(`${fullPath}.metadata`, metadata);
          } catch (error) {
            // Failed to create the metadata file so remove the created directory.
            await fsPromises.rmdir(fullPath);
            reject(error);
            return;
          }
        }
        resolve({ path: this.mapFilepathToUrl(fullPath) });
      } catch (error) {
        reject(new MethodNotAllowedHttpError());
      }
    });
  }

  /**
   * Helper function without extra validation checking to create a data file.
   * @param path - The filepath of the file to be created.
   * @param data - The data to be put in the file.
   */
  private async createDataFile(path: string, data: Readable): Promise<void> {
    return new Promise((resolve, reject): any => {
      const writeStream = createWriteStream(path);
      data.pipe(writeStream);
      data.on('error', reject);

      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });
  }

  /**
   * Helper function to generate quads for a Container or Resource.
   * @param subject - The NamedNode for which the quads should be generated.
   * @param stats - The Stats of the subject.
   *
   * @returns The generated quads.
   */
  private generateResourceQuads(subject: NamedNode, stats: Stats): Quad[] {
    const quads: Quad[] = [];

    if (stats.isDirectory()) {
      quads.push(DataFactory.quad(subject, this.predicates.aType, this.objects.container));
      quads.push(DataFactory.quad(subject, this.predicates.aType, this.objects.basicContainer));
    }
    quads.push(DataFactory.quad(subject, this.predicates.aType, this.objects.ldpResource));
    quads.push(DataFactory.quad(subject, this.predicates.size, DataFactory.literal(stats.size)));
    quads.push(DataFactory.quad(
      subject,
      this.predicates.modified,
      DataFactory.literal(stats.mtime.toUTCString(), this.objects.dateTime),
    ));
    quads.push(DataFactory.quad(
      subject,
      this.predicates.mtime,
      DataFactory.literal(stats.mtime.getTime() / 100),
    ));

    return quads;
  }
}
