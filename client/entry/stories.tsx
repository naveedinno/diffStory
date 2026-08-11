// Bundle entry for review history. Built by scripts/build-client.mjs into
// dist/client/stories.js and requested by the shell's module script.
import type { StoriesPayload } from "../../src/payloads";
import { mountSurface } from "../shared/mount";
import { readShellPayload } from "../shared/payload";
import { StoriesApp } from "../surfaces/stories/StoriesApp";

mountSurface(<StoriesApp payload={readShellPayload<StoriesPayload>()} />);
