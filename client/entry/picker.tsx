// Bundle entry for the repository picker. Built by scripts/build-client.mjs
// into dist/client/picker.js and requested by the shell's module script.
import type { PickerPayload } from "../../src/payloads";
import { mountSurface } from "../shared/mount";
import { readShellPayload } from "../shared/payload";
import { PickerApp } from "../surfaces/picker/PickerApp";

mountSurface(<PickerApp payload={readShellPayload<PickerPayload>()} />);
