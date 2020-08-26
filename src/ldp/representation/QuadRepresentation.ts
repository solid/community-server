import { Readable } from 'stream';
import { Representation } from './Representation';

/**
 * A representation containing quads as data.
 */
export interface QuadRepresentation extends Representation {
  dataType: 'quad';
  data: Readable;
}
