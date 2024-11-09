import { useEffect, useRef } from 'react';

const PreloadManager = ({ videoUrls, videoData }) => {
  const preloadedVideos = useRef(new Map());

  const convertTimeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    try {
      const [minutes, seconds] = timeStr.split(':').map(Number);
      return minutes * 60 + seconds;
    } catch (error) {
      console.warn('Error converting time:', error);
      return 0;
    }
  };

  useEffect(() => {
    videoUrls.forEach((url, index) => {
      if (!url || preloadedVideos.current.has(url)) return;

      try {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.playsInline = true;
        video.muted = true;
        video.autoplay = false;
        
        const handleCanPlay = () => {
          try {
            const videoInfo = videoData[index];
            if (!videoInfo?.fields?.isFullVideo && videoInfo?.fields?.start_time) {
              const startTime = convertTimeToSeconds(videoInfo.fields.start_time);
              if (video.readyState >= 3) {
                video.currentTime = startTime;
                video.pause();
              }
            }
          } catch (error) {
            console.warn('Error setting preload video time:', error);
          }
        };

        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.addEventListener('loadeddata', () => video.pause(), { once: true });
        
        video.src = url;
        video.load();

        preloadedVideos.current.set(url, {
          element: video,
          videoInfo: videoData[index]
        });
      } catch (error) {
        console.warn('Error creating preload video:', error);
      }
    });

    return () => {
      preloadedVideos.current.forEach(({ element }) => {
        try {
          if (element) {
            element.removeEventListener('canplay', element.oncanplay);
            element.src = '';
          }
        } catch (error) {
          console.warn('Error cleaning up preloaded video:', error);
        }
      });
      preloadedVideos.current.clear();
    };
  }, [videoUrls, videoData]);

  return null;
};

export default PreloadManager;
