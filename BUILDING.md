# Gallery-DL Web - Docker Build

This project is primarily built and deployed using Docker. The `Dockerfile` handles all necessary build steps, including installing dependencies and setting up the application environment.

## Building the Docker Image

To build the Docker image, navigate to the project root and run:

```bash
docker build -t web-dl-manager .
```

## Running the Docker Container

After building the image, you can run the container:

```bash
docker run -d \
  -p 8000:8000 \
  -v ./gallery-dl-data:/data \
  --name web-dl-manager \
  web-dl-manager
```

Refer to the `README.md` for more detailed instructions on running the container and configuring environment variables.

## Requirements for Building

- Docker

The `Dockerfile` handles all Python dependencies and system packages.

## What the Build Includes

- The main application code
- All necessary Python and system dependencies
- Templates and static files
- Configuration files

## Notes

- The application runs within a Docker container, providing an isolated and consistent environment.
- All dependencies are managed within the Docker image.