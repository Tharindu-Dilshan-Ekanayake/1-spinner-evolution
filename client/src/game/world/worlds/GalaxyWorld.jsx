import { DECOR } from '../decor'
import StageWorld from '../StageWorld'

/** World 3: stages 21-30 among the stars (Rebirth 7 + Stage 20). Loaded lazily. */
export default function GalaxyWorld() {
  return <StageWorld worldId="galaxy" decor={DECOR.galaxy} />
}
