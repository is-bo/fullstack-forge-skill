# Nontechnical guide

Fullstack Forge is a production-engineering playbook for your AI coding agent.

After installation, ask for the outcome normally—for example, “Let doctors cancel appointments and
notify patients.” Forge tells the agent to inspect the existing application, choose only relevant
specialists, implement through current patterns, consider common failures, add tests, verify the
result, and say what remains uncertain.

You usually do not need a Forge command. Explicit commands are useful when you deliberately want a
security audit, a verification pass, or a release gate.

Forge scales its effort:

- a label change gets a small focused check;
- a normal feature gets architecture inspection, relevant playbooks, tests, and a final pass;
- passwords, permissions, payments, private data, uploads, destructive data changes, or secrets get
  stronger safety and evidence requirements.

Forge does not guarantee that software is production-ready merely because code was written. It
records failures, unavailable checks, and decisions honestly. The AI agent does the reasoning and
implementation; the Forge CLI records evidence and enforces the checks it can prove.

Install with the steps in [GETTING_STARTED.md](GETTING_STARTED.md). If activation is missing, see
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).
