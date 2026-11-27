# Physical-device accessibility and resilience acceptance

Status: manual acceptance pending. Automated Chromium checks do not substitute for physical Android/iOS testing.

## Test targets

Record exact device model, OS version, browser, test date, tester and build revision for each run.

- Android: current supported Chrome + TalkBack on one small phone and one standard phone.
- iOS: current supported Safari + VoiceOver on one small iPhone and one standard iPhone.
- Desktop: keyboard-only Chrome/Firefox/Safari where available, 200% zoom and high-contrast mode.

## Required scenarios

1. Open the hosted preview from a clean browser profile and verify the displayed build revision.
2. Navigate all primary sections using touch, keyboard and screen-reader rotor/landmarks.
3. Verify the skip link moves focus to main content and SPA navigation moves focus to the destination heading.
4. Verify every form field has an announced label, instructions and validation error; errors must not be color-only.
5. Run the salary remainder, taxable-income, investment, property, business and treaty examples with valid and invalid inputs. Confirm focus remains predictable after validation and results are announced.
6. Check 320 CSS-pixel width, portrait/landscape rotation, 200% text zoom and large system font settings without horizontal scrolling or clipped controls.
7. Confirm controls have practical touch targets, visible focus, sufficient contrast and no hover-only interaction.
8. Test keyboard operation for disclosures, search, navigation, buttons and calculator controls.
9. Confirm reduced-motion preferences are respected and no auto-playing or flashing content is present.
10. Confirm local encrypted financial-profile workflows do not expose profile contents in URLs, network requests, browser console or exported evidence.
11. Test browser back/forward, reload, offline transition and recovery after a failed calculation; the app must not present stale calculations as current.
12. Capture screenshots/video only with test data. Do not use real taxpayer records.

## Acceptance record

A tester must mark each scenario pass/fail/not-applicable, attach the exact revision and record defects. Any critical keyboard, screen-reader, form-label, clipping, privacy or calculation-state defect blocks release. Founder signs the consolidated result; an independent reviewer confirms critical fixes.

## Automated coverage already in CI

The browser suite exercises 320, 390 and 1440 pixel viewports, no horizontal overflow, duplicate IDs, labeled controls, ARIA references, skip-link and SPA focus, tool navigation, calculation parity, initial payload size and readiness timing. These are regression tests, not physical device acceptance.
