import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api", // Next.js app router API folder
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Lumis API Documentation",
        version: "1.0",
        description: "API for Lumis Academic Document Management & AI Synthesis Platform",
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [], // By default, no security. Apply BearerAuth to specific routes
    },
  });
  return spec;
};
