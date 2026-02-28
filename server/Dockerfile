
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app/server

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (use npm ci for clean install)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Install LaTeX and related tools
# texlive: Basic LaTeX installation
# texlive-xetex: For xelatex support
# texlive-luatex: For lualatex support
# texlive-dvi: For synctex (often included here)
# fontconfig: For font management
RUN apk add --no-cache \
    texlive \
    texlive-xetex \
    texlive-luatex \
    fontconfig

# Create the projects directory (it might be mounted as a volume, but creating ensures it exists)
RUN mkdir -p /app/projects

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
