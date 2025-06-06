# Mask Builder

A React application for creating camera masks for specific camera and lens models with varying lens positions.

## Features

- Simple password authentication for internal use
- Real API integration with Google Cloud Storage
- List of puppets (cameras) with existing mask information
- Mask editor with:
  - Initial circular mask
  - Keyboard controls for positioning and resizing
  - Shape drawing tools (freeform and point-by-point)
  - Selection and manipulation of shapes
  - Preview mode with transparency toggle
  - Mask generation and upload

## Backend API

The application includes a Node.js Express server that:
1. Acts as a middleware between the frontend and Google Cloud Storage
2. Handles authentication and access control
3. Provides endpoints for listing puppets, checking mask status, getting video frames, and uploading masks
4. Serves the React frontend in production

## Keyboard Controls

- **Arrow Keys**: Move selected shape's position
- **+ / -**: Increase/decrease selected shape's size
- **T**: Toggle transparency
- **Esc**: Abandon current shape / Deselect
- **Delete**: Remove selected shape/point

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Place your Google Cloud service account key in the project root as `key.json`
   - The key must have read/write permissions (but not delete) to the bucket

3. Start the development environment (both server and frontend):
   ```
   npm run dev
   ```

## Authentication

The app uses a simple password authentication system. The default password is `SenseiSux15!`. This can be changed in the `Login.js` component.

## Production Deployment

1. Build the React app:
   ```
   npm run build
   ```

2. Start the server which will serve the React app and provide the API:
   ```
   npm run server
   ```

## Requirements

- Node.js and npm
- Google Cloud service account with access to the bucket

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
