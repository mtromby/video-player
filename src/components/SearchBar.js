import React, { useState } from 'react';

const SearchBar = ({ onSearch, onVideoSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length >= 2) {
      const results = onSearch(term);
      setSearchResults(results);
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleVideoSelect = (video) => {
    onVideoSelect(video);
    setShowResults(false);
    setSearchTerm('');
  };

  return (
    <div className="search-container">
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearch}
        placeholder="Search videos..."
        className="search-input"
      />
      {showResults && searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((video) => (
            <div
              key={video.id}
              className="search-result-item"
              onClick={() => handleVideoSelect(video)}
            >
              <h3>{video.fields.title}</h3>
              {video.fields.clip_tags && (
                <div className="search-result-tags">
                  {Array.isArray(video.fields.clip_tags) 
                    ? video.fields.clip_tags.join(', ')
                    : video.fields.clip_tags}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
