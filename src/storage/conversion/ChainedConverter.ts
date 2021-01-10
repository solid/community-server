import type { Representation } from '../../ldp/representation/Representation';
import { getLoggerFor } from '../../logging/LogUtil';
import { matchesMediaType } from './ConversionUtil';
import type { RepresentationConverterArgs } from './RepresentationConverter';
import { TypedRepresentationConverter } from './TypedRepresentationConverter';

/**
 * A meta converter that takes an array of other converters as input.
 * It chains these converters by finding intermediate types that are supported by converters on either side.
 */
export class ChainedConverter extends TypedRepresentationConverter {
  protected readonly logger = getLoggerFor(this);

  private readonly converters: TypedRepresentationConverter[];

  /**
   * Creates the chain of converters based on the input.
   * The list of `converters` needs to be at least 2 long.
   * @param converters - The chain of converters.
   */
  public constructor(converters: TypedRepresentationConverter[]) {
    super();
    if (converters.length < 2) {
      throw new Error('At least 2 converters are required.');
    }
    this.converters = [ ...converters ];
    this.inputTypes = this.first.getInputTypes();
    this.outputTypes = this.last.getOutputTypes();
  }

  protected get first(): TypedRepresentationConverter {
    return this.converters[0];
  }

  protected get last(): TypedRepresentationConverter {
    return this.converters[this.converters.length - 1];
  }

  public async handle(input: RepresentationConverterArgs): Promise<Representation> {
    const args = { ...input };
    for (let i = 0; i < this.converters.length - 1; ++i) {
      const value = await this.getMatchingType(this.converters[i], this.converters[i + 1]);
      args.preferences = { type: { [value]: 1 }};
      args.representation = await this.converters[i].handle(args);
    }
    args.preferences = input.preferences;
    return this.last.handle(args);
  }

  /**
   * Finds the best media type that can be used to chain 2 converters.
   */
  protected async getMatchingType(left: TypedRepresentationConverter, right: TypedRepresentationConverter):
  Promise<string> {
    const inputTypes = await right.getInputTypes();
    const outputTypes = await left.getOutputTypes();
    let bestMatch: { type: string; weight: number } = { type: 'invalid', weight: 0 };

    // Try to find the matching type with the best weight
    const inputKeys = Object.keys(inputTypes);
    const outputKeys = Object.keys(outputTypes);
    for (const outputType of outputKeys) {
      const outputWeight = outputTypes[outputType];
      if (outputWeight <= bestMatch.weight) {
        continue;
      }
      for (const inputType of inputKeys) {
        const inputWeight = inputTypes[inputType];
        const weight = outputWeight * inputWeight;
        if (weight > bestMatch.weight && matchesMediaType(inputType, outputType)) {
          bestMatch = { type: outputType, weight };
          if (weight === 1) {
            this.logger.debug(`${bestMatch.type} is an exact match between ${outputKeys} and ${inputKeys}`);
            return bestMatch.type;
          }
        }
      }
    }

    if (bestMatch.weight === 0) {
      this.logger.warn(`No match found between ${outputKeys} and ${inputKeys}`);
      throw new Error(`No match found between ${outputKeys} and ${inputKeys}`);
    }

    this.logger.debug(`${bestMatch.type} is the best match between ${outputKeys} and ${inputKeys}`);
    return bestMatch.type;
  }
}
