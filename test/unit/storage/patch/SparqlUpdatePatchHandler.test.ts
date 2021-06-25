import 'jest-rdf';
import { namedNode, quad } from '@rdfjs/data-model';
import arrayifyStream from 'arrayify-stream';
import type { Quad } from 'rdf-js';
import { translate } from 'sparqlalgebrajs';
import type { SparqlUpdatePatch } from '../../../../src/ldp/http/SparqlUpdatePatch';
import { BasicRepresentation } from '../../../../src/ldp/representation/BasicRepresentation';
import { RepresentationMetadata } from '../../../../src/ldp/representation/RepresentationMetadata';
import type { RepresentationConverterArgs,
  RepresentationConverter } from '../../../../src/storage/conversion/RepresentationConverter';
import { SparqlUpdatePatchHandler } from '../../../../src/storage/patch/SparqlUpdatePatchHandler';
import type { ResourceStore } from '../../../../src/storage/ResourceStore';
import { INTERNAL_QUADS } from '../../../../src/util/ContentTypes';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';
import { NotImplementedHttpError } from '../../../../src/util/errors/NotImplementedHttpError';
import { guardedStreamFrom } from '../../../../src/util/StreamUtil';

describe('A SparqlUpdatePatchHandler', (): void => {
  let converter: jest.Mocked<RepresentationConverter>;
  let handler: SparqlUpdatePatchHandler;
  let source: jest.Mocked<ResourceStore>;
  let startQuads: Quad[];
  const defaultType = 'internal/not-quads';
  const identifier = { path: 'http://test.com/foo' };
  const fulfilledDataInsert = 'INSERT DATA { :s1 :p1 :o1 . :s2 :p2 :o2 . }';

  beforeEach(async(): Promise<void> => {
    startQuads = [ quad(
      namedNode('http://test.com/startS1'),
      namedNode('http://test.com/startP1'),
      namedNode('http://test.com/startO1'),
    ), quad(
      namedNode('http://test.com/startS2'),
      namedNode('http://test.com/startP2'),
      namedNode('http://test.com/startO2'),
    ) ];

    converter = {
      handleSafe: jest.fn(async({ representation, preferences }: RepresentationConverterArgs): Promise<any> =>
        new BasicRepresentation(representation.data, Object.keys(preferences.type!)[0])),
    } as any;

    source = {
      getRepresentation: jest.fn(async(): Promise<any> => new BasicRepresentation(startQuads, defaultType)),
      setRepresentation: jest.fn(),
    } as any;

    handler = new SparqlUpdatePatchHandler(converter, defaultType);
  });

  async function basicChecks(quads: Quad[]): Promise<boolean> {
    expect(source.getRepresentation).toHaveBeenCalledTimes(1);
    expect(source.getRepresentation).toHaveBeenLastCalledWith(identifier, { });
    expect(converter.handleSafe).toHaveBeenCalledTimes(2);
    expect(converter.handleSafe).toHaveBeenCalledWith({
      representation: await source.getRepresentation.mock.results[0].value,
      identifier,
      preferences: { type: { [INTERNAL_QUADS]: 1 }},
    });
    expect(converter.handleSafe).toHaveBeenLastCalledWith({
      representation: expect.objectContaining({ binary: false, metadata: expect.any(RepresentationMetadata) }),
      identifier,
      preferences: { type: { [defaultType]: 1 }},
    });

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    const setParams = source.setRepresentation.mock.calls[0];
    expect(setParams[0]).toEqual(identifier);
    expect(setParams[1]).toEqual(expect.objectContaining({
      binary: true,
      metadata: expect.any(RepresentationMetadata),
    }));
    expect(setParams[1].metadata.contentType).toEqual(defaultType);
    await expect(arrayifyStream(setParams[1].data)).resolves.toBeRdfIsomorphic(quads);
    return true;
  }

  async function handle(query: string): Promise<void> {
    const prefixedQuery = `prefix : <http://test.com/>\n${query}`;
    await handler.handle({
      source,
      identifier,
      patch: {
        algebra: translate(prefixedQuery, { quads: true }),
        data: guardedStreamFrom(prefixedQuery),
        metadata: new RepresentationMetadata(),
        binary: true,
      } as SparqlUpdatePatch,
    });
  }

  it('only accepts SPARQL updates.', async(): Promise<void> => {
    const input = { source, identifier, patch: { algebra: {}} as SparqlUpdatePatch };
    await expect(handler.canHandle(input)).resolves.toBeUndefined();
    delete (input.patch as any).algebra;
    await expect(handler.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('handles NOP operations by not doing anything.', async(): Promise<void> => {
    await handle('');
    expect(source.getRepresentation).toHaveBeenCalledTimes(0);
    expect(converter.handleSafe).toHaveBeenCalledTimes(0);
    expect(source.setRepresentation).toHaveBeenCalledTimes(0);
  });

  it('handles INSERT DATA updates.', async(): Promise<void> => {
    await handle(fulfilledDataInsert);
    expect(await basicChecks(startQuads.concat(
      [ quad(namedNode('http://test.com/s1'), namedNode('http://test.com/p1'), namedNode('http://test.com/o1')),
        quad(namedNode('http://test.com/s2'), namedNode('http://test.com/p2'), namedNode('http://test.com/o2')) ],
    ))).toBe(true);
  });

  it('handles DELETE DATA updates.', async(): Promise<void> => {
    await handle('DELETE DATA { :startS1 :startP1 :startO1 }');
    expect(await basicChecks(
      [ quad(namedNode('http://test.com/startS2'),
        namedNode('http://test.com/startP2'),
        namedNode('http://test.com/startO2')) ],
    )).toBe(true);
  });

  it('handles DELETE WHERE updates with no variables.', async(): Promise<void> => {
    const query = 'DELETE WHERE { :startS1 :startP1 :startO1 }';
    await handle(query);
    expect(await basicChecks(
      [ quad(namedNode('http://test.com/startS2'),
        namedNode('http://test.com/startP2'),
        namedNode('http://test.com/startO2')) ],
    )).toBe(true);
  });

  it('handles DELETE WHERE updates with variables.', async(): Promise<void> => {
    const query = 'DELETE WHERE { :startS1 :startP1 ?o }';
    await handle(query);
    expect(await basicChecks(
      [ quad(namedNode('http://test.com/startS2'),
        namedNode('http://test.com/startP2'),
        namedNode('http://test.com/startO2')) ],
    )).toBe(true);
  });

  it('handles DELETE/INSERT updates with empty WHERE.', async(): Promise<void> => {
    const query = 'DELETE { :startS1 :startP1 :startO1 } INSERT { :s1 :p1 :o1 . } WHERE {}';
    await handle(query);
    expect(await basicChecks([
      quad(namedNode('http://test.com/startS2'),
        namedNode('http://test.com/startP2'),
        namedNode('http://test.com/startO2')),
      quad(namedNode('http://test.com/s1'),
        namedNode('http://test.com/p1'),
        namedNode('http://test.com/o1')),
    ])).toBe(true);
  });

  it('handles composite INSERT/DELETE updates.', async(): Promise<void> => {
    const query = 'INSERT DATA { :s1 :p1 :o1 . :s2 :p2 :o2 };' +
      'DELETE WHERE { :s1 :p1 :o1 . :startS1 :startP1 :startO1 }';
    await handle(query);
    expect(await basicChecks([
      quad(namedNode('http://test.com/startS2'),
        namedNode('http://test.com/startP2'),
        namedNode('http://test.com/startO2')),
      quad(namedNode('http://test.com/s2'),
        namedNode('http://test.com/p2'),
        namedNode('http://test.com/o2')),
    ])).toBe(true);
  });

  it('handles composite DELETE/INSERT updates.', async(): Promise<void> => {
    const query = 'DELETE DATA { :s1 :p1 :o1 . :startS1 :startP1 :startO1 } ;' +
      'INSERT DATA { :s1 :p1 :o1 . :s2 :p2 :o2 }';
    await handle(query);
    expect(await basicChecks([
      quad(namedNode('http://test.com/startS2'),
        namedNode('http://test.com/startP2'),
        namedNode('http://test.com/startO2')),
      quad(namedNode('http://test.com/s1'),
        namedNode('http://test.com/p1'),
        namedNode('http://test.com/o1')),
      quad(namedNode('http://test.com/s2'),
        namedNode('http://test.com/p2'),
        namedNode('http://test.com/o2')),
    ])).toBe(true);
  });

  it('rejects GRAPH inserts.', async(): Promise<void> => {
    const query = 'INSERT DATA { GRAPH :graph { :s1 :p1 :o1 } }';
    await expect(handle(query)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects GRAPH deletes.', async(): Promise<void> => {
    const query = 'DELETE DATA { GRAPH :graph { :s1 :p1 :o1 } }';
    await expect(handle(query)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects DELETE/INSERT updates with non-BGP WHERE.', async(): Promise<void> => {
    const query = 'DELETE { :s1 :p1 :o1 } INSERT { :s1 :p1 :o1 } WHERE { ?s ?p ?o. FILTER (?o > 5) }';
    await expect(handle(query)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects INSERT WHERE updates with a UNION.', async(): Promise<void> => {
    const query = 'INSERT { :s1 :p1 :o1 . } WHERE { { :s1 :p1 :o1 } UNION { :s1 :p1 :o2 } }';
    await expect(handle(query)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects non-DELETE/INSERT updates.', async(): Promise<void> => {
    const query = 'MOVE DEFAULT TO GRAPH :newGraph';
    await expect(handle(query)).rejects.toThrow(NotImplementedHttpError);
  });

  it('throws the error returned by the store if there is one.', async(): Promise<void> => {
    source.getRepresentation.mockRejectedValueOnce(new Error('error'));
    await expect(handle(fulfilledDataInsert)).rejects.toThrow('error');
  });

  it('creates a new resource if it does not exist yet.', async(): Promise<void> => {
    startQuads = [];
    source.getRepresentation.mockRejectedValueOnce(new NotFoundHttpError());
    const query = 'INSERT DATA { <http://test.com/s1> <http://test.com/p1> <http://test.com/o1>. }';
    await handle(query);

    expect(converter.handleSafe).toHaveBeenCalledTimes(1);
    expect(converter.handleSafe).toHaveBeenLastCalledWith({
      representation: expect.objectContaining({ binary: false, metadata: expect.any(RepresentationMetadata) }),
      identifier,
      preferences: { type: { [defaultType]: 1 }},
    });

    const quads =
      [ quad(namedNode('http://test.com/s1'), namedNode('http://test.com/p1'), namedNode('http://test.com/o1')) ];
    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    const setParams = source.setRepresentation.mock.calls[0];
    expect(setParams[1].metadata.contentType).toEqual(defaultType);
    await expect(arrayifyStream(setParams[1].data)).resolves.toBeRdfIsomorphic(quads);
  });

  it('defaults to text/turtle if no default type was set.', async(): Promise<void> => {
    handler = new SparqlUpdatePatchHandler(converter);
    startQuads = [];
    source.getRepresentation.mockRejectedValueOnce(new NotFoundHttpError());
    const query = 'INSERT DATA { <http://test.com/s1> <http://test.com/p1> <http://test.com/o1>. }';
    await handle(query);

    expect(source.setRepresentation).toHaveBeenCalledTimes(1);
    const setParams = source.setRepresentation.mock.calls[0];
    expect(setParams[1].metadata.contentType).toEqual('text/turtle');
  });
});
