import type {NextConfig} from "next";
const config:NextConfig={output:"standalone",poweredByHeader:false,serverExternalPackages:["web-push"],experimental:{cpus:2}};
export default config;
