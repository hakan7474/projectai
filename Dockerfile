# Multi-stage build for Next.js application
FROM node:22-alpine AS base


WORKDIR /app

# Build arguments for environment variables
ARG MONGODB_URI
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG GEMINI_API_KEY

RUN echo "Building with MONGODB URI: $MONGODB_URI"
RUN echo "Building with NEXT AUTH URL: $NEXTAUTH_URL"
RUN echo "Building with NEXT AUTH SECRET: $NEXTAUTH_SECRET"
RUN echo "Building with GEMINI API KEY: $GEMINI_API_KEY"

# Copy package files
COPY package*.json ./

RUN npm install

# Copy all files
COPY . .


# Set environment variables for build
ENV MONGODB_URI=$MONGODB_URI
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

EXPOSE 3006

# Start app
CMD ["npm", "run", "start"]
