# Scripts

Project commands are exposed through the root `Makefile` and the documented PowerShell commands in [`../README.md`](../README.md).

The project intentionally keeps operational scripting small: Docker Compose manages the services and `src/config/seed.py` loads deterministic sample data.
