import React, { useState, useEffect, useRef } from 'react';

export default function AddressInput({ value, onChange, placeholder = "Enter address..." }) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    // Sync from parent correctly
    useEffect(() => {
        if (value !== undefined && value !== null) {
            setQuery(value);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query || query === value || query.length < 3) {
            setSuggestions([]);
            return;
        }
        
        const delayBounceFn = setTimeout(() => {
            // Mock realistic address autocompletion
            const words = query.trim().split(' ');
            const num = isNaN(words[0]) ? Math.floor(Math.random() * 900) + 100 : words[0];
            const street = words.length > 1 ? words.slice(1).join(' ') : 'Main St';
            const mockData = [
                { display_name: `${num} ${street}, Austin, TX 78701, USA` },
                { display_name: `${num} ${street}, San Francisco, CA 94105, USA` },
                { display_name: `${num} ${street}, New York, NY 10001, USA` },
                { display_name: `${num} ${street} Suite 100, Austin, TX 78701, USA` }
            ];
            
            setSuggestions(mockData);
            setShowSuggestions(true);
        }, 300);

        return () => clearTimeout(delayBounceFn);
    }, [query, value]);

    const handleSelect = (suggestion) => {
        const addressName = suggestion.display_name;
        setQuery(addressName);
        onChange(addressName);
        setShowSuggestions(false);
    };

    const handleChange = (e) => {
        setQuery(e.target.value);
        onChange(e.target.value);
        setShowSuggestions(true);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input 
                type="text" 
                className="input-field" 
                value={query}
                onChange={handleChange}
                placeholder={placeholder}
                onFocus={() => setShowSuggestions(query.length >= 3 && suggestions.length > 0)}
                required
            />
            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-rl-gray-3 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((s, i) => (
                        <li 
                            key={i} 
                            className="px-4 py-3 hover:bg-rl-gray-4 cursor-pointer text-sm text-rl-dark border-b border-rl-gray-3 last:border-0 leading-tight"
                            onClick={() => handleSelect(s)}
                        >
                            {s.display_name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
