import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { getApiDocs } from "@/lib/swagger";

export default async function ApiDocsPage() {
  const spec = getApiDocs();
  
  return (
    <div style={{ height: "100vh", padding: "20px" }}>
      <SwaggerUI spec={spec} />
    </div>
  );
}
