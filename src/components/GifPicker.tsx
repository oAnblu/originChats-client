import { useState, useEffect, useRef } from "preact/hooks";
import type { TargetedInputEvent } from "preact";
import { Icon } from "./Icon";
import { favGifs as dbFavGifs } from "../lib/db";

interface GifResult {
  id: string;
  media: GifMedia[];
  title: string;
  itemurl: string;
  created: number;
}

interface GifMedia {
  url: string;
  preview: string;
  tinygif: {
    url: string;
  };
  gif: {
    url: string;
  };
  nanogif: {
    url: string;
  };
}

interface SavedGif {
  url: string;
  savedAt: number;
}

export interface GifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
  anchorRef?: { current: HTMLElement | null };
}

export function GifPicker({
  isOpen,
  onClose,
  onSelect,
  anchorRef,
}: GifPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"favorites" | "search">(
    "favorites",
  );
  const [savedGifs, setSavedGifs] = useState<SavedGif[]>([]);
  const searchTimer = useRef<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSavedGifs();
  }, []);

  useEffect(() => {
    if (isOpen && anchorRef?.current && pickerRef.current) {
      positionPicker();
    }
  }, [isOpen, anchorRef]);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !anchorRef?.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, anchorRef, onClose]);

  const positionPicker = () => {
    if (!anchorRef?.current || !pickerRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();

    const isMobile = window.innerWidth <= 768;
    let x = rect.left;
    let y = rect.bottom + 5;

    if (isMobile) {
      x = 0;
      y = window.innerHeight - pickerRect.height;
    } else {
      if (x + pickerRect.width > window.innerWidth - 10) {
        x = window.innerWidth - pickerRect.width - 10;
      }
      if (y + pickerRect.height > window.innerHeight - 10) {
        y = rect.top - pickerRect.height - 5;
      }
    }

    pickerRef.current.style.left = `${x}px`;
    pickerRef.current.style.top = `${y}px`;
  };

  const loadSavedGifs = () => {
    dbFavGifs.get().then((saved) => {
      if (saved.length > 0) {
        setSavedGifs(saved);
      }
    });
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setActiveTab("favorites");
      setResults([]);
      return;
    }

    setLoading(true);
    setResults([]);
    setActiveTab("search");

    try {
      const response = await fetch(
        `https://apps.mistium.com/tenor/search?query=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      const gifs = data.results || data;
      setResults(gifs);
    } catch (error) {
      console.error("Failed to search GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInput = (e: TargetedInputEvent<HTMLInputElement>) => {
    const query = e.currentTarget.value;
    setSearchTerm(query);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(() => {
      if (query.trim()) {
        searchGifs(query);
      } else {
        setActiveTab("favorites");
      }
    }, 500);
  };

  const handleSearch = () => {
    searchGifs(searchTerm);
  };

  const handleSelect = (gifUrl: string) => {
    onSelect(gifUrl);
    onClose();
  };

  const toggleFavorite = (gifUrl: string) => {
    const existingIndex = savedGifs.findIndex((g) => g.url === gifUrl);
    let updated: SavedGif[];

    if (existingIndex >= 0) {
      updated = savedGifs.filter((_, i) => i !== existingIndex);
    } else {
      updated = savedGifs.concat({ url: gifUrl, savedAt: Date.now() });
    }

    setSavedGifs(updated);
    dbFavGifs.set(updated);
  };

  const isFavorite = (gifUrl: string): boolean => {
    return savedGifs.some((g) => g.url === gifUrl);
  };

  const getDisplayGifs = (): Array<{
    id: string;
    previewUrl: string;
    fullUrl: string;
    title: string;
  }> => {
    if (activeTab === "favorites") {
      return savedGifs.map((g) => ({
        id: "",
        previewUrl: g.url,
        fullUrl: g.url,
        title: `Saved ${savedGifs.indexOf(g) + 1}`,
      }));
    }

    return results.map((g) => {
      const media = g.media?.[0];
      const previewUrl = media?.tinygif?.url || media?.preview || "";
      const fullUrl = media?.gif?.url || media?.nanogif?.url || g.itemurl;
      return {
        id: g.id,
        previewUrl,
        fullUrl,
        title: g.title || "",
      };
    });
  };

  if (!isOpen) return null;

  return (
    <div ref={pickerRef} className="gif-picker">
      <div className="gif-picker-header">
        <button
          className={`gif-tab ${activeTab === "favorites" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("favorites");
            setSearchTerm("");
          }}
        >
          <Icon name="Star" size={16} /> Favorites
        </button>
        <button
          className={`gif-tab ${activeTab === "search" ? "active" : ""}`}
          onClick={() => {
            if (!searchTerm) setActiveTab("search");
            else if (!loading) handleSearch();
          }}
        >
          <Icon name="Search" size={16} /> Search
        </button>
        <button className="gif-close" onClick={onClose}>
          <Icon name="X" size={16} />
        </button>
      </div>

      {activeTab === "search" && (
        <div className="gif-search-bar">
          <input
            type="text"
            placeholder="Search Tenor GIFs..."
            value={searchTerm}
            onInput={handleSearchInput}
            autoFocus
          />
        </div>
      )}

      <div className="gif-results">
        {loading ? (
          <div className="gif-loading">Loading...</div>
        ) : activeTab === "favorites" && savedGifs.length === 0 ? (
          <div className="gif-empty">
            <Icon name="Star" size={48} />
            <p>No favorites yet</p>
          </div>
        ) : activeTab === "search" && results.length === 0 && searchTerm ? (
          <div className="gif-empty">
            <Icon name="Search" size={48} />
            <p>No results found</p>
          </div>
        ) : (
          <div className="gif-grid">
            {getDisplayGifs()
              .slice(0, 50)
              .map((gif) => (
                <div key={gif.id || gif.fullUrl} className="gif-item">
                  <img
                    src={gif.previewUrl}
                    alt={gif.title || "GIF"}
                    className="gif-result-img"
                    onClick={() => handleSelect(gif.fullUrl)}
                  />
                  <button
                    className={`gif-fav-btn ${isFavorite(gif.fullUrl) ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(gif.fullUrl);
                    }}
                  >
                    <Icon
                      name={isFavorite(gif.fullUrl) ? "Star" : "Star"}
                      size={16}
                      fill={isFavorite(gif.fullUrl) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
