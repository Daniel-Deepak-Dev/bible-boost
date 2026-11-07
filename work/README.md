# work/

Planning and knowledge for BibleBoost. No runtime code lives here.

```
work/
  requirements/     epics, tasks and bugs — what to build
  understandings/   durable knowledge — what you must know before building it
  status.sh         prints the board from the task files
```

## If you are starting a task

1. `work/requirements/README.md` — pick the next task whose dependencies are Done
2. Read the task file in full
3. **Read the files its Reference section links to** in `work/understandings/`
4. Follow `work/understandings/conventions/03-task-workflow.md`

## If you are an AI with no context

Read, in this order:

1. [`AGENTS.md`](../AGENTS.md) at the repo root — the hard rules
2. [`work/understandings/README.md`](understandings/README.md) — what is known
   and how confident we are
3. The task you have been given

Do not guess about bible.com's DOM. It has been studied; several obvious
assumptions are documented as wrong.

## The relationship between the two folders

**Requirements** say *what* and *why*. **Understandings** say *what is true*.

A task file should never restate a fact from an understanding file — it should
link to it. That way a correction lands in one place and every task that depends
on it is corrected at once.

When a task teaches you something durable, it goes in `understandings/`. When a
task reveals more work, it becomes a new task file.

## Status

```bash
sh work/status.sh
```

The `Status` line inside each task file is the single source of truth.
`requirements/README.md` is an index, not a board.
