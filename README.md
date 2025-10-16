# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js

### 1. Install Dependencies

Run the following command in your terminal:

```bash
npm install
```

### 2. Configure Environment Variables

This project requires several environment variables for both the client-side application and the back-end server.

Create a file named `.env` in the root of your project and add the following content. **Replace the placeholder values** with your actual keys and URLs.

```env
# For Gemini API access (used by the client)
# This is provided by the AI Studio environment, but required for local development.
API_KEY="your_gemini_api_key_here"

# For PostgreSQL database connection (used by the server)
DATABASE_URL="postgresql://user:password@host:port/database"

# For client-side Supabase connection. Get these from your Supabase project's API settings.
VITE_SUPABASE_URL="your_supabase_project_url_here"
VITE_SUPABASE_ANON_KEY="your_supabase_public_anon_key_here"

# For server-side Supabase broadcasting.
# SUPABASE_URL is the same as VITE_SUPABASE_URL.
# SUPABASE_SERVICE_KEY is the secret "service_role" key from your Supabase project's API settings.
SUPABASE_URL="your_supabase_project_url_here"
SUPABASE_SERVICE_KEY="your_supabase_service_role_key_here"
```

**IMPORTANT:**
- The variables starting with `VITE_` are exposed to the client-side code by Vite.
- The other variables are used by the server. Using a single `.env` file simplifies local setup.

### 3. Run the App

Once your `.env` file is configured, run the app with:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.