import assert from 'assert';
import { promises as fsPromises } from 'fs';
import arrayifyStream from 'arrayify-stream';
import { BasicRepresentation } from '../../ldp/representation/BasicRepresentation';
import type { Representation } from '../../ldp/representation/Representation';
import type { TemplateEngine } from '../../pods/generate/TemplateEngine';
import { INTERNAL_ERROR } from '../../util/ContentTypes';
import { HttpError } from '../../util/errors/HttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import { joinFilePath, resolveAssetPath } from '../../util/PathUtil';
import type { RepresentationConverterArgs } from './RepresentationConverter';
import { TypedRepresentationConverter } from './TypedRepresentationConverter';

/**
 * Serializes an Error by filling in the provided template.
 * Content-type is based on the constructor parameter.
 *
 * In case the input Error has an `errorCode` value,
 * the converter will look in the `descriptions` for a file
 * with the exact same name as that error code + `extension`.
 * The templating engine will then be applied to that file.
 * That result will be passed as an additional parameter to the main templating call,
 * using the variable `codeMessage`.
 */
export class ErrorToTemplateConverter extends TypedRepresentationConverter {
  private readonly engine: TemplateEngine;
  private readonly templatePath: string;
  private readonly descriptions: string;
  private readonly contentType: string;
  private readonly extension: string;

  public constructor(engine: TemplateEngine, templatePath: string, descriptions: string, contentType: string,
    extension: string) {
    super(INTERNAL_ERROR, contentType);
    this.engine = engine;
    this.templatePath = resolveAssetPath(templatePath);
    this.descriptions = resolveAssetPath(descriptions);
    this.contentType = contentType;
    this.extension = extension;
  }

  public async handle({ representation }: RepresentationConverterArgs): Promise<Representation> {
    const errors = await arrayifyStream(representation.data);
    if (errors.length !== 1) {
      throw new InternalServerError('Only single errors are supported.');
    }
    const error = errors[0] as Error;

    // Render the template
    const { name, message, stack } = error;
    const description = await this.getErrorCodeMessage(error);
    const variables = { name, message, stack, description };
    const template = await fsPromises.readFile(this.templatePath, 'utf8');
    const rendered = this.engine.apply(template, variables);

    return new BasicRepresentation(rendered, representation.metadata, this.contentType);
  }

  private async getErrorCodeMessage(error: Error): Promise<string | undefined> {
    if (HttpError.isInstance(error) && error.errorCode) {
      let template: string;
      try {
        const fileName = `${error.errorCode}${this.extension}`;
        assert(/^[\w.]+$/u.test(fileName), 'Invalid error template name');
        template = await fsPromises.readFile(joinFilePath(this.descriptions, fileName), 'utf8');
      } catch {
        // In case no template is found we still want to convert
        return;
      }

      return this.engine.apply(template, (error.details ?? {}) as NodeJS.Dict<string>);
    }
  }
}
