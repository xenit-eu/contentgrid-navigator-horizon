// Listed as a router exemption in the test config: L2 is off here, L4 still applies.
import { useBlocker } from "@tanstack/react-router";

export const guard = useBlocker;
