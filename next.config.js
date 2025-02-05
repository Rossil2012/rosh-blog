const { withContentlayer } = require('next-contentlayer2');

/** @type {import('next').NextConfig} */
const nextConfig = {
    // reactStrictMode: false
}

module.exports = withContentlayer(nextConfig);
