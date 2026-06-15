# Kubernetes Manifests

Kubernetes deployment files are planned but intentionally not scaffolded yet.

The current MVP should prove the product locally with Docker Compose first:

- FastAPI API
- Celery worker
- React frontend
- PostgreSQL
- Redis

Once the MVP workflow is stable, add manifests for:

- API deployment and service
- Worker deployment
- Frontend deployment and service
- PostgreSQL stateful set or managed database connection
- Redis deployment or managed Redis connection
- ConfigMap and Secret references
- Ingress

Until then, this folder documents deployment intent without committing empty
placeholder YAML files.
