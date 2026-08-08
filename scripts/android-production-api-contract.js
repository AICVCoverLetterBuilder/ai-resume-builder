'use strict';

const ANDROID_PRODUCTION_API_BASE_URL = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';
const LEGACY_ANDROID_API_BASE_URL = 'https://ai-resume-builder-six-gamma.vercel.app';
const ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION = 'android-production-api-host-contract-408-v1';

function enforceAndroidProductionApiBaseUrl(env = process.env) {
  env.NEXT_PUBLIC_API_BASE_URL = ANDROID_PRODUCTION_API_BASE_URL;
  return ANDROID_PRODUCTION_API_BASE_URL;
}

module.exports = {
  ANDROID_PRODUCTION_API_BASE_URL,
  LEGACY_ANDROID_API_BASE_URL,
  ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION,
  enforceAndroidProductionApiBaseUrl,
};