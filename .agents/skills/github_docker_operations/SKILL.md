---
name: github_docker_operations
description: Guidelines and instructions for automating Git, GitHub, and Docker deployment workflows.
---
# GitHub and Docker Operations Skill

This skill equips the agent with guidelines and procedures to automate project versioning, repository syncing, image building, Docker Hub operations, and production deployments.

## 1. Git & GitHub Workflows
- **Branch Verification**: Always verify the current branch before executing push commands:
  ```powershell
  git branch --show-current
  ```
- **Commit Messages**: Use descriptive, standard commit messages (preferably in Vietnamese following Conventional Commits format):
  - `feat: thêm file cấu hình docker`
  - `fix: sửa lỗi cổng kết nối database`
- **One-Line Sync Command**:
  ```powershell
  git add . ; git commit -m "feat: cập nhật cấu hình dự án" ; git push origin <current-branch>
  ```

## 2. Docker Operations
- **App Configuration**:
  - Expose Port: `3005` (matches `.env` APP_URL).
  - PostgreSQL Host Port: `5433` mapped to Container Port `5432`.
- **Local Hot-Reload/Update**:
  Run `docker_run_local.bat` to rebuild and update the local containers.
- **Docker Hub Deployment (vinhle158)**:
  Run `docker_push_hub.bat` to build, tag (`vinhle158/studiov2-app:latest`), and push.

## 3. Server Deployment
To deploy updates to the production server:
1. Ensure the image is pushed via `docker_push_hub.bat`.
2. Run `docker_update_server.sh` on the server to pull and recreate the container with zero build-overhead.
