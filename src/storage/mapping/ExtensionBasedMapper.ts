import { promises as fsPromises } from 'fs';
import * as mime from 'mime-types';
import type { ResourceIdentifier } from '../../ldp/representation/ResourceIdentifier';
import { APPLICATION_TRIG, TEXT_TURTLE } from '../../util/ContentTypes';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';
import { joinFilePath, getExtension } from '../../util/PathUtil';
import { BaseFileIdentifierMapper } from './BaseFileIdentifierMapper';
import type { FileIdentifierMapperFactory, ResourceLink } from './FileIdentifierMapper';

export class ExtensionBasedMapper extends BaseFileIdentifierMapper {
  private readonly types: Record<string, any>;
  private readonly mimeFallback: Record<string, string>;

  public constructor(
    base: string,
    rootFilepath: string,
    overrideTypes: Record<string, string> = { acl: TEXT_TURTLE, meta: TEXT_TURTLE, trig: APPLICATION_TRIG },
  ) {
    super(base, rootFilepath);
    this.types = { ...mime.types, ...overrideTypes };
    this.mimeFallback = {};
    for (const [ extension, contentType ] of Object.entries(overrideTypes)) {
      this.mimeFallback[contentType] = extension;
    }
  }

  protected async mapUrlToDocumentPath(identifier: ResourceIdentifier, filePath: string, contentType?: string):
  Promise<ResourceLink> {
    // Would conflict with how new extensions are stored
    if (/\$\.\w+$/u.test(filePath)) {
      this.logger.warn(`Identifier ${identifier.path} contains a dollar sign before its extension`);
      throw new NotImplementedHttpError('Identifiers cannot contain a dollar sign before their extension');
    }

    // Existing file
    if (!contentType) {
      // Find a matching file
      const [ , folder, documentName ] = /^(.*\/)(.*)$/u.exec(filePath)!;
      let fileName: string | undefined;
      try {
        const files = await fsPromises.readdir(folder);
        fileName = files.find((file): boolean =>
          file.startsWith(documentName) && /^(?:\$\..+)?$/u.test(file.slice(documentName.length)));
      } catch {
        // Parent folder does not exist (or is not a folder)
      }
      if (fileName) {
        filePath = joinFilePath(folder, fileName);
      }
      contentType = await this.getContentTypeFromPath(filePath);
    // If the extension of the identifier matches a different content-type than the one that is given,
    // we need to add a new extension to match the correct type.
    } else if (contentType !== await this.getContentTypeFromPath(filePath)) {
      const extension = mime.extension(contentType) || this.mimeFallback[contentType];
      if (!extension) {
        this.logger.warn(`No extension found for ${contentType}`);
        throw new NotImplementedHttpError(`Unsupported content type ${contentType}`);
      }
      filePath += `$.${extension}`;
    }
    return super.mapUrlToDocumentPath(identifier, filePath, contentType);
  }

  protected async getDocumentUrl(relative: string): Promise<string> {
    return super.getDocumentUrl(this.stripExtension(relative));
  }

  protected async getContentTypeFromPath(filePath: string): Promise<string> {
    return this.types[getExtension(filePath).toLowerCase()] ||
      super.getContentTypeFromPath(filePath);
  }

  /**
   * Helper function that removes the internal extension, one starting with $., from the given path.
   * Nothing happens if no such extension is present.
   */
  protected stripExtension(path: string): string {
    const extension = getExtension(path);
    if (extension && path.endsWith(`$.${extension}`)) {
      path = path.slice(0, -(extension.length + 2));
    }
    return path;
  }
}

export class ExtensionBasedMapperFactory implements FileIdentifierMapperFactory<ExtensionBasedMapper> {
  public async create(base: string, rootFilePath: string): Promise<ExtensionBasedMapper> {
    return new ExtensionBasedMapper(base, rootFilePath);
  }
}
