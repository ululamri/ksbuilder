declare global {
  namespace App {
    interface Locals {
      requestId: string;
    }
  }
}

declare module 'lottie-web/build/player/lottie_light.js' {
  import lottie from 'lottie-web';
  export default lottie;
}

export {};
