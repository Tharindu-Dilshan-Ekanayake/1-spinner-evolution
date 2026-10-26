import { DECOR } from '../decor'
import StageWorld from '../StageWorld'

/** World 2: stages 11-20 over a lava sea (Rebirth 2 + Stage 10). Loaded lazily. */
export default function LavaWorld() {
  return <StageWorld worldId="lava" decor={DECOR.lava} />
}
