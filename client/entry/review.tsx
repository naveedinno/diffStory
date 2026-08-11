// Bundle entry for the review page — the surface behind both
// `GET /repo/<name>/review` (with a story) and `GET /repo/<name>/diff`
// (storyless, same page, `storyless: true` in the payload).
import { mountSurface } from "../shared/mount";
import { readShellPayload } from "../shared/payload";
import { ReviewApp } from "../surfaces/review/ReviewApp";
import type { ReviewPayload } from "../../src/payloads";

mountSurface(<ReviewApp payload={readShellPayload<ReviewPayload>()} />);
