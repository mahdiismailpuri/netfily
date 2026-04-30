/**
 * Forwards incoming requests to the destination server
 * This module acts as an intermediary that routes web traffic
 * from end users to the main backend server
 */

// The destination server address is read from environment variables
// If not set, a default placeholder value is used
// Note: You must configure this variable in Netlify environment
const TARGET_SERVER = Netlify.env.get("BACKEND_URL") || "https://your-backend-server.com";

/**
 * Main request processing function
 * Receives all incoming HTTP requests and forwards them to the destination server
 * 
 * @param {Request} request - The incoming request object from the client
 * @param {Object} context - The Netlify execution context
 * @returns {Response} The final response to send back to the client
 */
export default async function processRequest(request, context) {
  try {
    // Extract the complete URL from the incoming request
    const url = new URL(request.url);
    
    // Preserve the path and query parameters
    // This ensures the URL structure is maintained during forwarding
    const targetPath = url.pathname + url.search;
    
    // Build the complete URL for the destination server
    // Append the request path to the main server address
    const destinationUrl = new URL(targetPath, TARGET_SERVER).toString();

    // Copy all headers from the incoming request
    // Headers contain important information like authorization, content-type, etc.
    const requestHeaders = new Headers(request.headers);
    
    // Remove headers that should be regenerated
    // These headers are automatically set by the destination server
    requestHeaders.delete("host");
    requestHeaders.delete("x-forwarded-proto");
    requestHeaders.delete("x-forwarded-host");

    // Construct a new request to send to the destination server
    // The request body is streamed to avoid memory consumption
    const forwardRequest = new Request(destinationUrl, {
      method: request.method,           // HTTP method (GET, POST, PUT, DELETE, etc.)
      headers: requestHeaders,          // Processed headers
      body: request.body,               // Request body as ReadableStream
      redirect: "manual",               // Avoid automatic redirects
    });

    // Send the request to the destination server and receive the response
    // This operation may take time, so we use async/await
    const serverResponse = await fetch(forwardRequest);

    // Prepare response headers to send back to the client
    const responseHeaders = new Headers();
    
    // Copy response headers from the destination server
    // Excluding hop-by-hop headers that should not be forwarded
    for (const [key, value] of serverResponse.headers.entries()) {
      // The following headers are related to TCP connection and should not be forwarded
      const hopByHopHeaders = ["transfer-encoding", "connection", "keep-alive"];
      if (!hopByHopHeaders.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    }

    // Return the response to the client
    // The response body is streamed
    return new Response(serverResponse.body, {
      status: serverResponse.status,           // HTTP status code (200, 404, 500, etc.)
      statusText: serverResponse.statusText,   // Status message
      headers: responseHeaders,                // Processed headers
    });
    
  } catch (error) {
    // Handle potential errors
    // If an error occurs at any stage, we log it and return an appropriate error
    console.error("Request processing error:", error);
    
    // Return an error response with status 502 (Bad Gateway)
    // This code indicates the issue originated from the destination server
    return new Response(`Server connection error: ${error.message}`, { 
      status: 502 
    });
  }
}
