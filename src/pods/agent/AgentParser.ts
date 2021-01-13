import type { Representation } from '../../ldp/representation/Representation';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { Agent } from './Agent';

/**
 * Parser that generates a {@link Agent} from the data in the given {@link Representation}.
 */
export abstract class AgentParser extends AsyncHandler<Representation, Agent> { }
