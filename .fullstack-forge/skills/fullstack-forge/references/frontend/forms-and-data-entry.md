# Forms and data entry

Owner: `forge-ux`, composed with `forge-accessibility` and `forge-frontend`.

## Load when

- Forms, filters, booking, checkout, onboarding, settings, bulk actions, or validation are in scope.

## Do not load when

- The view displays information without user input or selection.

## Input contract

Use visible labels, appropriate native controls, meaningful groups, autocomplete, locale-aware
input, and the keyboard or input mode that fits the data. Distinguish optional, required, disabled,
and read-only states semantically and visually. Do not ask for data before it is needed.

Validate at the boundary that owns the rule. Choose validation timing to help without punishing
normal entry. Place field errors near their control, provide a summary for multiple errors when
useful, move focus deliberately, announce changes, and state both the cause and a recovery action.

During submission, prevent accidental duplication while preserving retry. Keep entered values
through validation failure, timeout, permission renewal, and recoverable navigation. Confirm
destructive or bulk scope in plain language and offer undo where the domain permits it.

## Evidence

- Successful, invalid, server-error, timeout, duplicate-submit, and recovery behavior.
- Keyboard sequence, accessible names, announced errors, and focus after failure.
- Tests for input preservation and exactly one durable result.
- Locale and mobile-keyboard behavior when those capabilities apply.
