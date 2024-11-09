// src/App.js
import React, { useEffect, useState, useRef } from 'react';
import AirtableService from './services/AirtableService';
import './App.css';
import PreloadManager from './components/PreloadManager';
import SearchBar from './components/SearchBar';

const VideoCard = ({ videoData, nextVideoData, onVisible, isFirstVideo }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState('0:00');
  const [durationDisplay, setDurationDisplay] = useState('0:00');
  const containerRef = useRef(null);
  const playbackAttemptRef = useRef(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const descriptionRef = useRef(null);
  const overlayRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const dragStartXRef = useRef(null);
  const nextVideoRef = useRef(null);
  const [currentPanPosition, setCurrentPanPosition] = useState(50);
  const [panPoints, setPanPoints] = useState([]);
  const panAnimationRef = useRef(null);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const fastForwardRef = useRef(null);
  const fastForwardSpeed = 2; // You can adjust this value to change the fast-forward speed

  // Convert "M:SS" format to seconds
  const convertTimeToSeconds = (timeStr) => {
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  const handleVideoLoad = async (e) => {
    if (!videoRef.current) return;
    
    try {
      setIsLoading(true);
      
      // Wait for video to be ready
      if (videoRef.current.readyState < 3) {
        await new Promise((resolve) => {
          videoRef.current.addEventListener('canplay', resolve, { once: true });
        });
      }

       // Always pause the video initially
       videoRef.current.pause();
       setIsPlaying(false);

      // Set start time
      if (videoData.fields.start_time) {
        const startTime = convertTimeToSeconds(videoData.fields.start_time);
        videoRef.current.currentTime = startTime;
        
        // Wait for seeking to complete
        await new Promise((resolve) => {
          videoRef.current.addEventListener('seeked', resolve, { once: true });
        });
      }

      setIsLoading(false);
       // Autoplay first video after loading
       if (isFirstVideo) {
        attemptPlay();
      }
    } catch (error) {
      console.warn('Error in handleVideoLoad:', error);
      setIsLoading(false);
    }
  };

  const getVideoTimes = () => {
    // If there's no start_time and this isn't a full video, use 0
    const startTime = videoData.fields.start_time 
      ? convertTimeToSeconds(videoData.fields.start_time)
      : videoData.fields.isFullVideo 
        ? 0 
        : null;

    // If there's no end_time and this isn't a full video, use null
    const endTime = videoData.fields.end_time
      ? convertTimeToSeconds(videoData.fields.end_time)
      : videoData.fields.isFullVideo
        ? videoRef.current?.duration || null
        : null;

    return { startTime, endTime };
  };

  const handleTimeUpdate = (e) => {
    if (!videoRef.current) return;
    
    const { startTime, endTime } = getVideoTimes();
    
    if (!videoData.fields.isFullVideo && (startTime === null || endTime === null)) {
      handlePause();
      setError('Invalid clip times');
      return;
    }

    const currentTime = videoRef.current.currentTime;
    
    if (currentTime >= endTime || currentTime < startTime) {
      videoRef.current.currentTime = startTime;
    }
    
    const relativeTime = currentTime - startTime;
    const clipDuration = endTime - startTime;
    setCurrentTimeDisplay(formatTime(relativeTime));
    setDurationDisplay(formatTime(clipDuration));
    setProgress((relativeTime / clipDuration) * 100);

    const newPanPosition = calculatePanAnimation(relativeTime);
    setCurrentPanPosition(newPanPosition);
  };

  const handleVideoError = (e) => {
    setError('Error loading video');
    console.error('Video loading error:', e);
  };

  const attemptPlay = async () => {
    if (!videoRef.current) return;
    
    try {
      // Cancel any existing playback attempt
      if (playbackAttemptRef.current) {
        clearTimeout(playbackAttemptRef.current);
      }
      
      // Add a small delay before attempting to play
      playbackAttemptRef.current = setTimeout(async () => {
        try {
          if (videoRef.current.paused) {
            await videoRef.current.play();
            setIsPlaying(true);
          }
        } catch (error) {
          console.warn('Playback failed:', error);
          setIsPlaying(false);
        }
      }, 100);
    } catch (error) {
      console.warn('Play attempt failed:', error);
      setIsPlaying(false);
    }
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    
    // Cancel any pending play attempts
    if (playbackAttemptRef.current) {
      clearTimeout(playbackAttemptRef.current);
    }
    
    videoRef.current.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      attemptPlay();
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleProgress = (e) => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    const startTime = videoData.fields.start_time ? convertTimeToSeconds(videoData.fields.start_time) : 0;
    const endTime = videoData.fields.end_time ? convertTimeToSeconds(videoData.fields.end_time) : duration;
    
    const relativeTime = currentTime - startTime;
    const clipDuration = endTime - startTime;
    setCurrentTimeDisplay(formatTime(relativeTime));
    setDurationDisplay(formatTime(clipDuration));
    setProgress((relativeTime / clipDuration) * 100);
  };

  const getTimeFromMousePosition = (clientX) => {
    if (!progressBarRef.current || !videoRef.current) return null;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const percentage = (clientX - rect.left) / rect.width;
    const startTime = videoData.fields.start_time ? convertTimeToSeconds(videoData.fields.start_time) : 0;
    const endTime = videoData.fields.end_time ? convertTimeToSeconds(videoData.fields.end_time) : videoRef.current.duration;
    const clipDuration = endTime - startTime;
    
    return startTime + (percentage * clipDuration);
  };

  const handleProgressBarMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    
    const newTime = getTimeFromMousePosition(e.clientX);
    if (newTime !== null) {
      setPreviewTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    }

    // Add window event listeners
    window.addEventListener('mousemove', handleProgressBarMouseMove);
    window.addEventListener('mouseup', handleProgressBarMouseUp);
  };

  const handleProgressBarMouseMove = (e) => {
    if (!isDragging) return;
    
    const newTime = getTimeFromMousePosition(e.clientX);
    if (newTime !== null) {
      setPreviewTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    }
  };

  const handleProgressBarMouseUp = (e) => {
    if (!isDragging) return;
    
    const newTime = getTimeFromMousePosition(e.clientX);
    if (newTime !== null && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    
    setIsDragging(false);
    dragStartXRef.current = null;
    
    // Remove window event listeners
    window.removeEventListener('mousemove', handleProgressBarMouseMove);
    window.removeEventListener('mouseup', handleProgressBarMouseUp);
  };

  // Add cleanup effect for event listeners
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleProgressBarMouseMove);
      window.removeEventListener('mouseup', handleProgressBarMouseUp);
    };
  }, [isDragging]);

  const toggleOrientation = () => {
    setIsTransitioning(true);
    setIsLandscape(prev => !prev);
    // Reset pan position when switching to landscape
    if (!isLandscape) {
      setCurrentPanPosition(50);
    } else {
      // Restore initial pan position when switching back to portrait
      const initialPosition = panPoints[0]?.[1] ?? 50;
      setCurrentPanPosition(initialPosition);
    }
    setTimeout(() => {
      setIsTransitioning(false);
    }, 800);
  };

  const toggleDescription = () => {
    if (!descriptionRef.current || !overlayRef.current) return;
    
    if (isDescriptionExpanded) {
      // Collapse animation
      setIsDescriptionExpanded(false);
    } else {
      // Expand animation
      setIsDescriptionExpanded(true);
    }
  };

  // Update Intersection Observer
  useEffect(() => {
    const options = {
      threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Reset video position when becoming visible
          if (videoRef.current && videoData.fields.start_time) {
            const startTime = convertTimeToSeconds(videoData.fields.start_time);
            videoRef.current.currentTime = startTime;
          }
          attemptPlay();
          onVisible();
        } else {
          handlePause();
        }
      });
    }, options);

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
      if (playbackAttemptRef.current) {
        clearTimeout(playbackAttemptRef.current);
      }
    };
  }, [onVisible, videoData?.fields?.start_time]);

  const renderTags = () => {
    const tagsToShow = videoData.fields.clip_tags;
    
    if (!tagsToShow) return null;

    // Convert tags to array if they aren't already
    const tagsArray = Array.isArray(tagsToShow) 
      ? tagsToShow 
      : typeof tagsToShow === 'string' 
        ? tagsToShow.split(',') 
        : [tagsToShow];

    return tagsArray.map((tag, index) => (
      <span key={index} className="tag">
        {String(tag).trim()}
      </span>
    ));
  };

  // Enhanced preloading strategy
  useEffect(() => {
    if (!nextVideoData) return;

    // Create a new video element for preloading
    const preloadVideo = document.createElement('video');
    
    const handleLoad = () => {
      if (nextVideoData.fields.start_time) {
        preloadVideo.currentTime = convertTimeToSeconds(nextVideoData.fields.start_time);
      }
    };

    preloadVideo.addEventListener('loadedmetadata', handleLoad);
    preloadVideo.src = nextVideoData.fields.link;
    preloadVideo.load();

    return () => {
      preloadVideo.removeEventListener('loadedmetadata', handleLoad);
      preloadVideo.remove();
    };
  }, [nextVideoData]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const RotateIcon = ({ isLandscape }) => (
    <svg th
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
      style={{ 
        transform: isLandscape ? 'rotate(90deg)' : 'rotate(0deg)', 
        transition: 'transform 0.3s ease' 
      }}
    >
      <path 
        d="M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" 
        stroke="white" 
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Add this effect to handle initial video setup
  useEffect(() => {
    if (!videoRef.current || !videoData?.fields?.start_time) return;

    const startTime = convertTimeToSeconds(videoData.fields.start_time);
    
    // Set the start time as soon as metadata is loaded
    const handleMetadata = () => {
      try {
        if (videoRef.current) {
          videoRef.current.currentTime = startTime;
        }
      } catch (error) {
        console.warn('Error setting video start time:', error);
      }
    };

    try {
      if (videoRef.current.readyState >= 1) {
        // Metadata is already loaded
        videoRef.current.currentTime = startTime;
      } else {
        // Wait for metadata to load
        videoRef.current.addEventListener('loadedmetadata', handleMetadata);
      }
    } catch (error) {
      console.warn('Error in video setup:', error);
    }

    return () => {
      try {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleMetadata);
        }
      } catch (error) {
        console.warn('Error cleaning up video event listener:', error);
      }
    };
  }, [videoData?.fields?.start_time]);

  // Add this new effect to enforce clip boundaries
  useEffect(() => {
    if (!videoRef.current || !videoData.fields) return;

    const isClip = !videoData.fields.isFullVideo;
    const startTime = videoData.fields.start_time ? convertTimeToSeconds(videoData.fields.start_time) : 0;
    
    // iOS Safari specific handling
    const setVideoTime = () => {
      if (!videoRef.current) return;
      
      try {
        if (isClip || videoData.fields.start_time) {
          // For iOS, we need to load the video first
          videoRef.current.load();
          // Wait for canplay event which is more reliable on mobile
          videoRef.current.addEventListener('canplay', () => {
            if (videoRef.current) {
              videoRef.current.currentTime = startTime;
            }
          }, { once: true });
        }
      } catch (error) {
        console.warn('Error setting video time:', error);
      }
    };

    setVideoTime();

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('canplay', setVideoTime);
      }
    };
  }, [videoData?.fields]);

  const calculatePanPosition = (currentTime, points) => {
    if (!points?.length || isLandscape) return 50;

    // Find current segment
    const currentIndex = points.findIndex(([time], index) => {
      const nextTime = points[index + 1]?.[0] ?? Infinity;
      return currentTime >= time && currentTime < nextTime;
    });

    if (currentIndex === -1) return points[points.length - 1][1];

    const [time1, position1] = points[currentIndex];
    const [time2, position2] = points[currentIndex + 1] ?? [null, position1];

    if (!time2) return position1;

    // Linear interpolation
    const progress = (currentTime - time1) / (time2 - time1);
    return position1 + (position2 - position1) * progress;
  };

  useEffect(() => {
    if (!videoData?.fields?.pan_points) {
      setPanPoints([[0, 50]]);
      return;
    }

    try {
      const points = JSON.parse(videoData.fields.pan_points);
      setPanPoints(Array.isArray(points) ? points : [[0, 50]]);
    } catch (error) {
      console.warn('Error parsing pan_points:', error);
      setPanPoints([[0, 50]]);
    }
  }, [videoData?.fields?.pan_points]);

  const calculatePanAnimation = (currentTime) => {
    if (!panPoints?.length || isLandscape) return 50;

    // Find current segment
    const currentIndex = panPoints.findIndex(([time], index) => {
      const nextTime = panPoints[index + 1]?.[0] ?? Infinity;
      return currentTime >= time && currentTime < nextTime;
    });

    // If before first point or after last point
    if (currentIndex === -1) {
      return panPoints[panPoints.length - 1][1];
    }

    const [startTime, startPosition] = panPoints[currentIndex];
    const [endTime, endPosition] = panPoints[currentIndex + 1] ?? [null, startPosition];

    if (!endTime) return startPosition;

    // Calculate the exact position based on current time
    const timeProgress = (currentTime - startTime) / (endTime - startTime);
    return startPosition + (endPosition - startPosition) * timeProgress;
  };

  const smoothPanPosition = (newPosition) => {
    if (panAnimationRef.current) {
      cancelAnimationFrame(panAnimationRef.current);
    }
    const startPosition = currentPanPosition;
    const startTime = performance.now();
    const duration = 50; // Shorter duration for smoother updates
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Use easeInOutQuad for smoother interpolation
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const interpolatedPosition = startPosition + (newPosition - startPosition) * easeProgress;
      setCurrentPanPosition(interpolatedPosition);
      if (progress < 1) {
        panAnimationRef.current = requestAnimationFrame(animate);
      }
    };
    panAnimationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (panAnimationRef.current) {
        cancelAnimationFrame(panAnimationRef.current);
      }
    };
  }, []);

  // Validate required fields
  useEffect(() => {
    if (!videoData?.fields?.link) {
      console.warn('Video missing required link field:', videoData);
      setError('Video source unavailable');
      return;
    }
    
    // Validate other critical fields
    const requiredFields = {
      title: videoData.fields.title || 'Untitled',
      description: videoData.fields.description || '',
      isFullVideo: typeof videoData.fields.isFullVideo === 'boolean' 
        ? videoData.fields.isFullVideo 
        : true
    };
    
    // Update videoData with defaults for missing fields
    videoData.fields = {
      ...videoData.fields,
      ...requiredFields
    };
  }, [videoData]);

  useEffect(() => {
    return () => {
      if (fastForwardRef.current) {
        clearTimeout(fastForwardRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e) => {
    // Prevent if touching a button or control
    if (e.target.closest('button') || e.target.closest('.video-controls')) {
      return;
    }
    
    e.preventDefault();
    if (fastForwardRef.current) return;
    
    fastForwardRef.current = setTimeout(() => {
      setIsFastForwarding(true);
      if (videoRef.current) {
        videoRef.current.playbackRate = fastForwardSpeed;
      }
    }, 200);
  };

  const handleTouchEnd = () => {
    if (fastForwardRef.current) {
      clearTimeout(fastForwardRef.current);
      fastForwardRef.current = null;
    }
    
    if (isFastForwarding && videoRef.current) {
      videoRef.current.playbackRate = 1;
      setIsFastForwarding(false);
    }
  };

  return (
    <div className="video-card" ref={containerRef}>
      <div 
        className={`video-container ${isLandscape ? 'landscape-container' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          // Only trigger for left mouse button and not on buttons/controls
          if (e.button === 0 && !e.target.closest('button') && !e.target.closest('.video-controls')) {
            handleTouchStart(e);
          }
        }}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        <div className={`video-wrapper ${isLoading ? 'loading' : ''}`}>
          {isLoading && (
            <div className="video-loader">
              <div className="loader-spinner"></div>
            </div>
          )}
          <video
            ref={videoRef}
            src={videoData.fields.link}
            playsInline
            webkit-playsinline="true"
            preload="auto"
            muted={isMuted}
            loop={true}
            onLoadedData={handleVideoLoad}
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
            onClick={(e) => {
              // Only toggle play if we weren't fast-forwarding
              if (!isFastForwarding) {
                togglePlay();
              }
            }}
            className={`video-player 
              ${isLandscape ? 'landscape-mode' : 'portrait-mode'}
              ${isTransitioning ? 'transitioning' : ''}
              ${isLoading ? 'loading' : ''}`}
            style={{ 
              '--pan-position': isLandscape ? 50 : currentPanPosition 
            }}
          />
        </div>
        <button 
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        />
        <button 
          className="orientation-toggle-btn"
          onClick={toggleOrientation}
          aria-label={isLandscape ? "Switch to portrait" : "Switch to landscape"}
        >
          <RotateIcon isLandscape={isLandscape} />
        </button>
        <div 
          ref={overlayRef}
          className={`video-overlay ${isDescriptionExpanded ? 'expanded' : ''}`}
        >
          <button 
            className={`collapse-button ${isDescriptionExpanded ? 'visible' : ''}`}
            onClick={toggleDescription}
            aria-label="Collapse description"
          />
          <div className="video-info">
            <div className="video-header">
              <div className="video-title-section">
                <div className="title-row">
                  <div className="title-container">
                    <h2 className="title">
                      {videoData.fields.title}
                    </h2>
                  </div>
                </div>
                <div className="description-container">
                  <p 
                    ref={descriptionRef}
                    className="description"
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    {videoData.fields.description}
                  </p>
                  {!isDescriptionExpanded && (
                    <span 
                      className="more-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDescription();
                      }}
                    >
                      more
                    </span>
                  )}
                </div>
                <div className="tags">
                  {renderTags()}
                </div>
              </div>
            </div>
            <div className="video-controls">
              <div 
                ref={progressBarRef}
                className={`progress-bar ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleProgressBarMouseDown}
              >
                <div 
                  className="progress-filled" 
                  style={{ width: `${progress}%` }}
                />
                {isDragging && (
                  <div 
                    className="progress-preview"
                    style={{ left: `${(previewTime / videoRef.current?.duration || 1) * 100}%` }}
                  >
                    {formatTime(previewTime)}
                  </div>
                )}
              </div>
              <div className="time-display">
                <span>{currentTimeDisplay}</span>
                <span> / </span>
                <span>{durationDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [videos, setVideos] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const [page, setPage] = useState(1);
  const videosPerPage = 5;
  const loadingRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFirstVideo, setIsFirstVideo] = useState(true);

  // Get URLs for preloading (previous, current, and next videos)
  const getPreloadData = (currentIndex) => {
    const urls = [];
    const data = [];
    
    // Previous video
    if (currentIndex > 0) {
      urls.push(videos[currentIndex - 1]?.fields.link);
      data.push(videos[currentIndex - 1]);
    }
    
    // Current video
    urls.push(videos[currentIndex]?.fields.link);
    data.push(videos[currentIndex]);
    
    // Next video
    if (currentIndex < videos.length - 1) {
      urls.push(videos[currentIndex + 1]?.fields.link);
      data.push(videos[currentIndex + 1]);
    }
    
    // Next batch if near the end
    if (currentIndex >= videos.length - 2) {
      const nextBatchVideos = allVideos
        .slice((page - 1) * videosPerPage, (page - 1) * videosPerPage + 2);
      
      nextBatchVideos.forEach(video => {
        if (video) {
          urls.push(video.fields.link);
          data.push(video);
        }
      });
    }

    return {
      urls: urls.filter(Boolean),
      data: data.filter(Boolean)
    };
  };

  // Parse clips string into array of time pairs
  const parseClips = (clipsStr) => {
    console.log('Raw clips data:', clipsStr);
    if (!clipsStr) return [];
    try {
      // Remove any whitespace and ensure proper formatting
      const cleanStr = clipsStr.trim().replace(/\s/g, '');
      // If the string already starts with '[', don't add another one
      const jsonStr = cleanStr.startsWith('[') ? cleanStr : `[${cleanStr}]`;
      console.log('Parsing clips string:', jsonStr); // Debug log
      const parsed = JSON.parse(jsonStr);
      console.log('Parsed clips:', parsed); // Debug log
      return parsed;
    } catch (e) {
      console.warn('Could not parse clips array:', clipsStr, e);
      return [];
    }
  };

  // Function to shuffle array
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Update the processVideos function to handle clip-specific tags
  const processVideos = (data) => {
    const { videos, clips } = data;
    console.log('Processing videos:', videos);
    console.log('Processing clips:', clips);
    
    return videos.flatMap((video, videoIndex) => {
      // Find all clips that belong to this video
      const videoClips = video.fields.Clips 
        ? clips.filter(clip => video.fields.Clips.includes(clip.id))
        : [];
      
      console.log(`Video ${video.id} has ${videoClips.length} clips`);
      
      if (videoClips.length > 0) {
        return videoClips.map((clip, index) => ({
          ...video,
          id: `${video.id}-${videoIndex}-${index}`,
          fields: {
            ...video.fields,
            ...clip.fields,
            video_title: video.fields.title,
            clip_tags: clip.fields.tags,
            video_tags: video.fields.video_tags,
            isFullVideo: false,
            link: video.fields.link
          }
        }));
      }
      
      // Only return full videos that have no clips
      return [{
        ...video,
        id: `${video.id}-${videoIndex}-full`,
        fields: {
          ...video.fields,
          isFullVideo: true,
          video_tags: video.fields.video_tags
        }
      }];
    });
  };

  // Load more videos
  const loadMoreVideos = () => {
    const startIndex = (page - 1) * videosPerPage;
    const newVideos = allVideos.slice(startIndex, startIndex + videosPerPage);
    setVideos(prev => [...prev, ...newVideos]);
    setPage(prev => prev + 1);
  };

  // Initial load
  useEffect(() => {
    const loadVideos = async () => {
      const data = await AirtableService.fetchVideosAndClips();
      const processedVideos = processVideos(data);
      const shuffledVideos = shuffleArray(processedVideos);
      setAllVideos(shuffledVideos);
      setVideos(shuffledVideos.slice(0, videosPerPage));
      setPage(2);
    };
    loadVideos();
  }, []);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          // If we've shown all videos, reshuffle and start over
          if ((page - 1) * videosPerPage >= allVideos.length) {
            const reshuffledVideos = shuffleArray(allVideos);
            setAllVideos(reshuffledVideos);
            setPage(1);
            setVideos(reshuffledVideos.slice(0, videosPerPage));
          } else {
            loadMoreVideos();
          }
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [page, allVideos]);

  // Add this function to your App component
  const getVideoUrl = (url) => {
    if (!url) return '';
    // Add cache control headers for Google Cloud Storage videos
    if (url.includes('storage.googleapis.com')) {
      return {
        src: url,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };
    }
    return { src: url };
  };

  const handleSearch = (term) => {
    if (!term) return [];
    
    const searchTerm = term.toLowerCase();
    return allVideos.filter(video => {
      const title = video.fields.title?.toLowerCase() || '';
      const description = video.fields.description?.toLowerCase() || '';
      const tags = Array.isArray(video.fields.clip_tags) 
        ? video.fields.clip_tags.join(' ').toLowerCase()
        : (video.fields.clip_tags || '').toLowerCase();
      
      return title.includes(searchTerm) || 
             description.includes(searchTerm) || 
             tags.includes(searchTerm);
    });
  };

  const handleVideoSelect = (selectedVideo) => {
    // Find the selected video in allVideos
    const videoIndex = allVideos.findIndex(v => v.id === selectedVideo.id);
    if (videoIndex === -1) return;

    // Get the next few videos after the selected one
    const newVideos = [
      selectedVideo,
      ...allVideos.slice(videoIndex + 1, videoIndex + videosPerPage)
    ];

    // Update the videos array and reset the page
    setVideos(newVideos);
    setCurrentIndex(0);
    setPage(Math.floor(videoIndex / videosPerPage) + 2);
  };

  return (
    <div className="video-feed">
      <SearchBar 
        onSearch={handleSearch}
        onVideoSelect={handleVideoSelect}
      />
      <PreloadManager 
        videoUrls={getPreloadData(currentIndex).urls}
        videoData={getPreloadData(currentIndex).data}
      />
      {videos.map((video, index) => (
        <VideoCard 
          key={video.id} 
          videoData={video} 
          nextVideoData={videos[index + 1]}
          onVisible={() => setCurrentIndex(index)}
          isFirstVideo={isFirstVideo && index === 0}
        />
      ))}
      <div ref={loadingRef} className="loading-trigger">
        {/* Optional loading indicator */}
      </div>
    </div>
  );
}

export default App;