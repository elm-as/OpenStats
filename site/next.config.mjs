/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le binaire est servi depuis un stockage externe signe, pas depuis le site :
  // un fichier de 400 Mo n'a rien a faire dans le depot ni dans le build.
  poweredByHeader: false,
};

export default nextConfig;
