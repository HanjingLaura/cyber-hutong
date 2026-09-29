# Pixel world UI verification

## Scope

Desktop pixel-life game for the existing eight-member roster. Preserve the supplied
art, authentication, private chat transport and controls. Design dials: variance 3,
motion 3, density 4. Native CSS/Canvas, green accent, sharp borders. No generic AI
branding or marketing shell. Mobile redesign is intentionally out of scope.

## Implementation

- The frontal office illustration is login-only. The two side-view illustrations
  share one canonical Hutong world; reverse-view clicks, directions, seats, chairs
  and speech use the same reversible projection.
- Continuous movement uses local footprint-constrained prediction and buffered
  remote interpolation. Stop input sequence acknowledgements prevent stale idle
  snapshots from cancelling short taps. Settling clears only the local actor's
  obsolete interpolation history.
- The server validates all movement and limits stale held input to 600ms.
  Position saves are checkpointed once a second while walking and flushed on stop.
- Character poses split at actual transparent gutters rather than equal sixths.
  Overlapping ferret poses use connected-pixel masks. Backdrop holes and edge green
  spill are removed without replacing the original source files.
- Real-time dialogue follows character heads. Existing two-participant delivery
  remains unchanged. Cross-scene replies open the active chat history, or show a
  private-message notice if another conversation is open. Automatic replies remain
  identified. Visiting characters use contextual scripted speech, not fake member
  accounts.
- Scene-specific actor scales follow the artwork. POP MART's display island is
  excluded from navigation. Path grids include the same footprint as movement.

## Observed browser checks (isolated in-memory fixture)

- 1440x900 desktop: both real Hutong backgrounds load; camera changes preserve actor
  positions, invert horizontal input correctly, and keep speech attached.
- A 250ms delayed movement request with a 1.6s hold rendered 378 sampled frames with
  no reverse jumps greater than 2px. A 50ms tap after the stop-settling fix rendered
  157 sampled frames with no reverse jumps greater than 2px. This is a bounded
  regression scenario, not a claim covering all network conditions or frame rates.
- Sending to Franco in the same scene displayed one bubble per speaker, with the
  history hidden. From Hawaii, Franco's reply opened the history automatically.
- Aborting the reverse background request displayed a retry control. Removing the
  fault and retrying loaded the asset and removed the control.
- All 48 member poses had non-clipped bounds after extraction. Four NPC sheets
  loaded; the ferret's overlapping side/walk poses were independently segmented.
- All nine scene renderers were inspected with the same member sprite and did not
  set the stage error indicator. Light/dark desktop presentation was inspected.
- Desktop Lighthouse on the isolated login fixture scored performance 88 and
  accessibility 100, with LCP 2.4s. This is a local lab measurement, not production
  telemetry. Image delivery remains an optimization opportunity; automatic
  accessibility checks do not replace manual testing.

## Automated coverage

`npm test` covers identity/claim/reset, private chat, server-controlled movement,
leases, footprint boundaries, checkpoint persistence, stop acknowledgement,
interpolation/settling, green-screen masks, uneven pose spacing, overlapping masks,
camera round trips, visiting-character speech and behavior routes.

The fixture is `node scripts/ui-smoke-server.mjs` at `127.0.0.1:8798`. It uses an
in-memory database and mock completion; it does not read production accounts or
API credentials. Names use the fixed roster; its password is `ui-test-only-123`.

## Operational boundary

The real-time server owns in-memory movement and SSE subscriptions and should run
as one persistent Node process. Vercel's temporary SQLite directory/serverless
instances are not a durable shared multiplayer backend. Asset mappings are kept
compatible with that entry point, but this UI work does not claim to solve durable
multi-instance hosting. No production accounts or data were changed in validation.
