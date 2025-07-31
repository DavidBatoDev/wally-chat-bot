'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Users, Bell, Calendar, ArrowUp, ArrowDown, Command } from 'lucide-react';
import { useTranslationStore } from '@/lib/store/TranslationStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Project, TeamMember, Notification } from '@/types/translation';

interface SearchResult {
  id: string;
  type: 'project' | 'team-member' | 'notification';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  data: Project | TeamMember | Notification;
  relevance: number;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { projects, teamMembers, notifications, currentUser, selectProject } = useTranslationStore();

  // Search functionality
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const queryLower = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search projects
    projects.forEach(project => {
      const relevance = calculateRelevance(project, queryLower);
      if (relevance > 0) {
        searchResults.push({
          id: project.id,
          type: 'project',
          title: `${project.qCode} - ${project.clientName}`,
          subtitle: `${project.sourceLanguage} → ${project.targetLanguages.join(', ')} | ${project.status}`,
          icon: <FileText className="w-4 h-4" />,
          data: project,
          relevance
        });
      }
    });

    // Search team members
    teamMembers.forEach(member => {
      const relevance = calculateRelevance(member, queryLower);
      if (relevance > 0) {
        searchResults.push({
          id: member.id,
          type: 'team-member',
          title: member.name,
          subtitle: `${member.role} | ${member.languages?.join(', ') || 'No languages'}`,
          icon: <Users className="w-4 h-4" />,
          data: member,
          relevance
        });
      }
    });

    // Search notifications
    notifications.forEach(notification => {
      const relevance = calculateRelevance(notification, queryLower);
      if (relevance > 0) {
        searchResults.push({
          id: notification.id,
          type: 'notification',
          title: notification.title,
          subtitle: notification.message,
          icon: <Bell className="w-4 h-4" />,
          data: notification,
          relevance
        });
      }
    });

    // Sort by relevance
    searchResults.sort((a, b) => b.relevance - a.relevance);
    setResults(searchResults.slice(0, 10)); // Limit to top 10 results
    setIsLoading(false);
  }, [projects, teamMembers, notifications]);

  const calculateRelevance = (item: any, query: string): number => {
    let relevance = 0;
    
    if (item.qCode?.toLowerCase().includes(query)) relevance += 10;
    if (item.clientName?.toLowerCase().includes(query)) relevance += 8;
    if (item.name?.toLowerCase().includes(query)) relevance += 8;
    if (item.title?.toLowerCase().includes(query)) relevance += 6;
    if (item.message?.toLowerCase().includes(query)) relevance += 4;
    if (item.status?.toLowerCase().includes(query)) relevance += 3;
    if (item.role?.toLowerCase().includes(query)) relevance += 3;
    if (item.languages?.some((lang: string) => lang.toLowerCase().includes(query))) relevance += 2;
    
    return relevance;
  };

  // Handle search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          setQuery('');
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'project':
        selectProject(result.data as Project);
        break;
      case 'team-member':
        // Navigate to team member profile
        console.log('Navigate to team member:', result.data);
        break;
      case 'notification':
        // Mark notification as read
        console.log('Mark notification as read:', result.data);
        break;
    }
    setIsOpen(false);
    setQuery('');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'ocr-processing': 'bg-purple-500',
      'pending-confirmation': 'bg-orange-500',
      'assigning-translator': 'bg-blue-500',
      'assigned': 'bg-blue-500',
      'in-progress': 'bg-yellow-500',
      'sent-back': 'bg-red-500',
      'pm-review': 'bg-orange-500',
      'completed': 'bg-green-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Trigger */}
      <Button
        variant="outline"
        className="w-full justify-start text-sm text-muted-foreground"
        onClick={() => setIsOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Search projects, team members...
        <div className="ml-auto flex items-center gap-1">
          <Command className="h-3 w-3" />
          <span className="text-xs">K</span>
        </div>
      </Button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[70vh] flex flex-col">
            {/* Search Header */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2">Searching...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="p-2">
                  {results.map((result, index) => (
                    <div
                      key={result.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        index === selectedIndex ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                      )}
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex-shrink-0 text-gray-500">
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">{result.title}</h4>
                          {result.type === 'project' && (
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs", getStatusColor((result.data as Project).status))}
                            >
                              {(result.data as Project).status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-gray-400">
                        {result.type === 'project' && (
                          <span>{(result.data as Project).qCode}</span>
                        )}
                        {result.type === 'team-member' && (
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={(result.data as TeamMember).avatar} />
                            <AvatarFallback className="text-xs">
                              {(result.data as TeamMember).name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : query ? (
                <div className="p-4 text-center text-gray-500">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No results found for "{query}"</p>
                  <p className="text-xs mt-1">Try different keywords or check your spelling</p>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>Start typing to search...</p>
                  <div className="mt-4 text-xs text-gray-400 space-y-1">
                    <p>• Search by project Q-code, client name, or status</p>
                    <p>• Find team members by name or role</p>
                    <p>• Look up notifications and messages</p>
                  </div>
                </div>
              )}
            </div>

            {/* Search Footer */}
            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
                <span>{results.length} results</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 