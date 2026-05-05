import { NextResponse } from "next/server"
import type { OpenAPIV3 } from "openapi-types"

// ──────────────────────────────────────────────
// OpenAPI 3.0 Specification for Coursify API
// ──────────────────────────────────────────────

const spec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Coursify WebApp API",
    description: "Course search and grade distribution platform for Queen's University",
    version: "1.0.0",
    contact: {
      name: "Coursify Team",
      url: "https://coursify.cloud",
    },
  },
  servers: [
    { url: "https://coursify.cloud/api", description: "Production" },
    { url: "http://localhost:3000/api", description: "Local development" },
  ],
  paths: {
    "/courses": {
      get: {
        summary: "List courses",
        description: "Search and filter courses with pagination",
        operationId: "listCourses",
        tags: ["Courses"],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Items per page" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Text search (course code or name)" },
          { name: "departments", in: "query", schema: { type: "string" }, description: "Comma-separated faculty names" },
          { name: "levels", in: "query", schema: { type: "string" }, description: "Comma-separated course levels (1-4)" },
          { name: "subjects", in: "query", schema: { type: "string" }, description: "Comma-separated subject prefixes (e.g. CISC, APSC)" },
          { name: "gpaMin", in: "query", schema: { type: "number", minimum: 0, maximum: 4.3 }, description: "Minimum GPA" },
          { name: "gpaMax", in: "query", schema: { type: "number", minimum: 0, maximum: 4.3 }, description: "Maximum GPA" },
          { name: "sortBy", in: "query", schema: { type: "string", enum: ["code", "name", "gpa", "enrollment", "availability"], default: "code" } },
          { name: "sortDir", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" } },
          { name: "hasData", in: "query", schema: { type: "boolean" }, description: "Only show courses with grade data or comments" },
          { name: "availabilityFilter", in: "query", schema: { type: "string" }, description: "Comma-separated: data,comments" },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    courses: { type: "array", items: { $ref: "#/components/schemas/Course" } },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    totalPages: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid query parameters" },
          "500": { description: "Internal server error" },
        },
      },
    },
    "/courses/{courseCode}": {
      get: {
        summary: "Get course details",
        description: "Get detailed information for a specific course",
        operationId: "getCourse",
        tags: ["Courses"],
        parameters: [
          { name: "courseCode", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Course details", content: { "application/json": { schema: { $ref: "#/components/schemas/Course" } } } },
          "404": { description: "Course not found" },
        },
      },
    },
    "/courses/{courseCode}/comments": {
      get: {
        summary: "Get course comments",
        description: "Get aggregated comments for a course",
        operationId: "getCourseComments",
        tags: ["Comments"],
        parameters: [
          { name: "courseCode", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Comments", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Comment" } } } } },
        },
      },
    },
    "/courses/departments": {
      get: {
        summary: "List departments",
        description: "Get all available departments/faculties",
        operationId: "listDepartments",
        tags: ["Courses"],
        responses: {
          "200": { description: "Departments list", content: { "application/json": { schema: { type: "array", items: { type: "string" } } } } },
        },
      },
    },
    "/courses/subjects": {
      get: {
        summary: "List subjects",
        description: "Get all available subject prefixes",
        operationId: "listSubjects",
        tags: ["Courses"],
        responses: {
          "200": { description: "Subjects list", content: { "application/json": { schema: { type: "array", items: { type: "string" } } } } },
        },
      },
    },
    "/upload-distribution": {
      post: {
        summary: "Upload grade distribution",
        description: "Upload a PDF grade distribution file",
        operationId: "uploadDistribution",
        tags: ["Uploads"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: {
          "200": { description: "Upload successful" },
          "401": { description: "Unauthorized" },
          "413": { description: "File too large" },
        },
      },
    },
    "/queens-answers/chat": {
      post: {
        summary: "Ask Queen's Answers",
        description: "Submit a question to the AI-powered course advisor",
        operationId: "askQueensAnswers",
        tags: ["Queens Answers"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", required: ["question"], properties: { question: { type: "string", maxLength: 2000 } } } } },
        },
        responses: {
          "200": { description: "Answer", content: { "application/json": { schema: { type: "object", properties: { answer: { type: "string" }, remaining: { type: "integer" } } } } } },
          "401": { description: "Unauthorized" },
          "403": { description: "Entitlement required" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/queens-answers/status": {
      get: {
        summary: "Get QA status",
        description: "Check Queen's Answers access status and remaining questions",
        operationId: "getQueensAnswersStatus",
        tags: ["Queens Answers"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "QA status" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/me/access-status": {
      get: {
        summary: "Get user access status",
        description: "Check current user's feature access status",
        operationId: "getAccessStatus",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Access status" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/me/academic-profile": {
      get: {
        summary: "Get academic profile",
        description: "Get current user's academic profile",
        operationId: "getAcademicProfile",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Academic profile" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/me/uploads": {
      get: {
        summary: "Get upload history",
        description: "Get current user's upload history",
        operationId: "getUploads",
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Upload history" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/stats/user-count": {
      get: {
        summary: "Get user count",
        description: "Get total registered user count",
        operationId: "getUserCount",
        tags: ["Stats"],
        responses: {
          "200": { description: "User count", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" } } } } } },
        },
      },
    },
    "/issues": {
      get: {
        summary: "List GitHub issues",
        description: "Get known issues and status updates",
        operationId: "getIssues",
        tags: ["Issues"],
        responses: {
          "200": { description: "Issues list" },
        },
      },
    },
  },
  components: {
    schemas: {
      Course: {
        type: "object",
        properties: {
          id: { type: "string" },
          course_code: { type: "string" },
          course_name: { type: "string" },
          description: { type: "string" },
          credits: { type: "number" },
          department: { type: "string" },
          averageGPA: { type: "number" },
          totalEnrollment: { type: "number" },
          hasComments: { type: "boolean" },
          dataAvailability: { type: "string", enum: ["full", "partial", "none"] },
          distributions: { type: "array", items: { $ref: "#/components/schemas/Distribution" } },
        },
      },
      Distribution: {
        type: "object",
        properties: {
          id: { type: "string" },
          semester: { type: "string" },
          grades: { type: "object" },
        },
      },
      Comment: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          reason: { type: "string" },
          dependency: { type: "string" },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Supabase JWT token",
      },
    },
  },
  tags: [
    { name: "Courses", description: "Course search and listing" },
    { name: "Comments", description: "Course comments and reviews" },
    { name: "Uploads", description: "Grade distribution uploads" },
    { name: "Queens Answers", description: "AI-powered course advisor" },
    { name: "User", description: "User profile and access management" },
    { name: "Stats", description: "Platform statistics" },
    { name: "Issues", description: "Known issues and status" },
  ],
}

export async function GET() {
  return NextResponse.json(spec)
}
