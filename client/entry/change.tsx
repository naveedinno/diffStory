// Bundle entry for the change / scope picker. Built by scripts/build-client.mjs
// into dist/client/change.js and requested by the shell's module script.
import type { ChangePayload } from "../../src/payloads";
import { mountSurface } from "../shared/mount";
import { readShellPayload } from "../shared/payload";
import { ChangeApp } from "../surfaces/change/ChangeApp";

mountSurface(<ChangeApp payload={readShellPayload<ChangePayload>()} />);
