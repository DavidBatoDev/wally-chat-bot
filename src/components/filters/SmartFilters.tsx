'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Filter,
  X,
  Search,
  Calendar,
  User,
  Tag,
  Clock,
  ChevronDown,
  Save,
  Trash2,
  Plus,
  Check,
  SortAsc,
  SortDesc,
  ArrowUpDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
// Remove Fuse.js dependency
// import Fuse from 'fuse.js';

// Simple search implementation
const simpleSearch = <T extends Record<string, any>>(
  items: T[],
  query: string,
  keys: string[]
): T[] => {
  if (!query) return items;
  
  const searchTerms = query.toLowerCase().split(' ');
  
  return items.filter(item => {
    return searchTerms.every(term => {
      return keys.some(key => {
        const value = key.split('.').reduce((obj, k) => obj?.[k], item);
        return String(value || '').toLowerCase().includes(term);
      });
    });
  });
};

// Define DateRange interface locally to avoid dependency
interface DateRange {
  from?: Date;
  to?: Date;
}

// Filter types
export interface FilterConfig {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'boolean';
  options?: Array<{ label: string; value: string }>;
  icon?: React.ElementType;
}

export interface FilterValue {
  filterId: string;
  value: any;
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'between';
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterValue[];
  isDefault?: boolean;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

interface SmartFiltersProps<T> {
  data: T[];
  filters: FilterConfig[];
  onFiltersChange: (filteredData: T[]) => void;
  searchKeys?: string[];
  presets?: FilterPreset[];
  onPresetsChange?: (presets: FilterPreset[]) => void;
  sortOptions?: Array<{ label: string; value: string }>;
  className?: string;
}

export function SmartFilters<T extends Record<string, any>>({
  data,
  filters,
  onFiltersChange,
  searchKeys = [],
  presets = [],
  onPresetsChange,
  sortOptions = [],
  className,
}: SmartFiltersProps<T>) {
  const [activeFilters, setActiveFilters] = useState<FilterValue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Simple search setup
  const searchData = useMemo(() => {
    if (searchKeys.length === 0) return data;
    return data;
  }, [data, searchKeys]);

  // Apply filters and sorting
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchQuery && searchKeys.length > 0) {
      result = simpleSearch(result, searchQuery, searchKeys);
    }

    // Apply filters
    activeFilters.forEach(filter => {
      const filterConfig = filters.find(f => f.id === filter.filterId);
      if (!filterConfig) return;

      result = result.filter(item => {
        const value = item[filter.filterId];
        
        switch (filterConfig.type) {
          case 'text':
            if (!value) return false;
            const textValue = String(value).toLowerCase();
            const searchValue = String(filter.value).toLowerCase();
            
            switch (filter.operator) {
              case 'contains':
                return textValue.includes(searchValue);
              case 'startsWith':
                return textValue.startsWith(searchValue);
              case 'endsWith':
                return textValue.endsWith(searchValue);
              case 'equals':
              default:
                return textValue === searchValue;
            }

          case 'select':
          case 'boolean':
            return value === filter.value;

          case 'multiselect':
            return Array.isArray(filter.value) && filter.value.includes(value);

          case 'number':
            const numValue = Number(value);
            const filterNum = Number(filter.value);
            
            switch (filter.operator) {
              case 'gt':
                return numValue > filterNum;
              case 'lt':
                return numValue < filterNum;
              case 'equals':
              default:
                return numValue === filterNum;
            }

          case 'date':
            const dateValue = new Date(value);
            const filterDate = new Date(filter.value);
            return dateValue.toDateString() === filterDate.toDateString();

          case 'daterange':
            const itemDate = new Date(value);
            const { from, to } = filter.value as DateRange;
            if (!from) return true;
            if (!to) return itemDate >= from;
            return itemDate >= from && itemDate <= to;

          default:
            return true;
        }
      });
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.field];
        const bValue = b[sortConfig.field];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, activeFilters, sortConfig, filters, searchKeys]);

  // Update parent when data changes
  React.useEffect(() => {
    onFiltersChange(processedData);
  }, [processedData, onFiltersChange]);

  // Add filter
  const addFilter = useCallback((filter: FilterValue) => {
    setActiveFilters(prev => [...prev, filter]);
  }, []);

  // Remove filter
  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f.filterId !== filterId));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters([]);
    setSearchQuery('');
    setSortConfig(null);
    setSelectedPreset(null);
  }, []);

  // Apply preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setActiveFilters(preset.filters);
      setSelectedPreset(presetId);
    }
  }, [presets]);

  // Save preset
  const savePreset = useCallback(() => {
    if (!presetName.trim() || !onPresetsChange) return;

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName,
      filters: activeFilters,
    };

    onPresetsChange([...presets, newPreset]);
    setPresetName('');
    setShowSavePreset(false);
  }, [presetName, activeFilters, presets, onPresetsChange]);

  // Delete preset
  const deletePreset = useCallback((presetId: string) => {
    if (!onPresetsChange) return;
    onPresetsChange(presets.filter(p => p.id !== presetId));
    if (selectedPreset === presetId) {
      setSelectedPreset(null);
    }
  }, [presets, selectedPreset, onPresetsChange]);

  // Get active filter count
  const activeFilterCount = activeFilters.length + (searchQuery ? 1 : 0) + (sortConfig ? 1 : 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        {searchKeys.length > 0 && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Filter Button */}
        <Popover open={showFilterBuilder} onOpenChange={setShowFilterBuilder}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <FilterBuilder
              filters={filters}
              activeFilters={activeFilters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
            />
          </PopoverContent>
        </Popover>

        {/* Sort */}
        {sortOptions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort
                {sortConfig && (
                  <Badge variant="secondary" className="ml-1">1</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Sort by</h4>
                <Select
                  value={sortConfig?.field || ''}
                  onValueChange={(value) => {
                    if (value) {
                      setSortConfig({ field: value, direction: 'asc' });
                    } else {
                      setSortConfig(null);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {sortOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sortConfig && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={sortConfig.direction === 'asc' ? 'default' : 'outline'}
                      onClick={() => setSortConfig({ ...sortConfig, direction: 'asc' })}
                      className="flex-1"
                    >
                      <SortAsc className="h-4 w-4 mr-1" />
                      Ascending
                    </Button>
                    <Button
                      size="sm"
                      variant={sortConfig.direction === 'desc' ? 'default' : 'outline'}
                      onClick={() => setSortConfig({ ...sortConfig, direction: 'desc' })}
                      className="flex-1"
                    >
                      <SortDesc className="h-4 w-4 mr-1" />
                      Descending
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Presets */}
        {presets.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Save className="h-4 w-4" />
                Presets
                {selectedPreset && (
                  <Badge variant="secondary" className="ml-1">
                    {presets.find(p => p.id === selectedPreset)?.name}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Filter Presets</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {presets.map(preset => (
                      <div
                        key={preset.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md hover:bg-gray-100 cursor-pointer",
                          selectedPreset === preset.id && "bg-blue-50"
                        )}
                        onClick={() => applyPreset(preset.id)}
                      >
                        <span className="text-sm">{preset.name}</span>
                        <div className="flex items-center gap-1">
                          {selectedPreset === preset.id && (
                            <Check className="h-3 w-3 text-blue-600" />
                          )}
                          {!preset.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePreset(preset.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Separator />
                {showSavePreset ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Preset name"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && savePreset()}
                    />
                    <Button size="sm" onClick={savePreset}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowSavePreset(false);
                        setPresetName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowSavePreset(true)}
                    disabled={activeFilters.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Save Current Filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-gray-600"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {activeFilters.map((filter, index) => {
              const filterConfig = filters.find(f => f.id === filter.filterId);
              if (!filterConfig) return null;

              return (
                <motion.div
                  key={`${filter.filterId}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {filterConfig.icon && <filterConfig.icon className="h-3 w-3" />}
                    <span>{filterConfig.label}:</span>
                    <span className="font-medium">
                      {formatFilterValue(filter.value, filterConfig.type)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-gray-300"
                      onClick={() => removeFilter(filter.filterId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Filter Builder Component
interface FilterBuilderProps {
  filters: FilterConfig[];
  activeFilters: FilterValue[];
  onAddFilter: (filter: FilterValue) => void;
  onRemoveFilter: (filterId: string) => void;
}

const FilterBuilder: React.FC<FilterBuilderProps> = ({
  filters,
  activeFilters,
  onAddFilter,
  onRemoveFilter,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [filterValue, setFilterValue] = useState<any>(null);
  const [filterOperator, setFilterOperator] = useState<FilterValue['operator']>('equals');

  const currentFilter = filters.find(f => f.id === selectedFilter);

  const handleAddFilter = () => {
    if (!selectedFilter || filterValue === null || filterValue === '') return;

    onAddFilter({
      filterId: selectedFilter,
      value: filterValue,
      operator: filterOperator,
    });

    // Reset
    setSelectedFilter('');
    setFilterValue(null);
    setFilterOperator('equals');
  };

  return (
    <div className="p-4 space-y-4">
      <h4 className="font-medium">Add Filter</h4>
      
      {/* Filter Selection */}
      <div className="space-y-2">
        <Label>Field</Label>
        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Select a field" />
          </SelectTrigger>
          <SelectContent>
            {filters.map(filter => (
              <SelectItem key={filter.id} value={filter.id}>
                <div className="flex items-center gap-2">
                  {filter.icon && <filter.icon className="h-4 w-4" />}
                  {filter.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter Value Input */}
      {currentFilter && (
        <>
          {/* Operator Selection for applicable types */}
          {['text', 'number'].includes(currentFilter.type) && (
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={filterOperator}
                onValueChange={(value) => setFilterOperator(value as FilterValue['operator'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentFilter.type === 'text' && (
                    <>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="startsWith">Starts with</SelectItem>
                      <SelectItem value="endsWith">Ends with</SelectItem>
                    </>
                  )}
                  {currentFilter.type === 'number' && (
                    <>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="gt">Greater than</SelectItem>
                      <SelectItem value="lt">Less than</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Value Input */}
          <div className="space-y-2">
            <Label>Value</Label>
            {renderFilterInput(currentFilter, filterValue, setFilterValue)}
          </div>

          <Button onClick={handleAddFilter} className="w-full">
            Add Filter
          </Button>
        </>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Active Filters</h4>
            {activeFilters.map((filter, index) => {
              const filterConfig = filters.find(f => f.id === filter.filterId);
              if (!filterConfig) return null;

              return (
                <div
                  key={`${filter.filterId}-${index}`}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <span className="text-sm">
                    {filterConfig.label}: {formatFilterValue(filter.value, filterConfig.type)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onRemoveFilter(filter.filterId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// Helper function to render filter input based on type
function renderFilterInput(
  filter: FilterConfig,
  value: any,
  onChange: (value: any) => void
) {
  switch (filter.type) {
    case 'text':
      return (
        <Input
          placeholder={`Enter ${filter.label.toLowerCase()}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          placeholder={`Enter ${filter.label.toLowerCase()}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        />
      );

    case 'select':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {filter.options?.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multiselect':
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filter.options?.map(option => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                checked={(value || []).includes(option.value)}
                onCheckedChange={(checked) => {
                  const currentValues = value || [];
                  if (checked) {
                    onChange([...currentValues, option.value]);
                  } else {
                    onChange(currentValues.filter((v: string) => v !== option.value));
                  }
                }}
              />
              <Label className="text-sm font-normal cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      );

    case 'date':
      return (
        <Input
          type="date"
          value={value ? format(new Date(value), 'yyyy-MM-dd') : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        />
      );

    case 'daterange':
      return (
        <div className="space-y-2">
          <Input
            type="date"
            placeholder="From date"
            value={value?.from ? format(new Date(value.from), 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const newFrom = e.target.value ? new Date(e.target.value) : null;
              onChange({ ...value, from: newFrom });
            }}
          />
          <Input
            type="date"
            placeholder="To date"
            value={value?.to ? format(new Date(value.to), 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const newTo = e.target.value ? new Date(e.target.value) : null;
              onChange({ ...value, to: newTo });
            }}
          />
        </div>
      );

    case 'boolean':
      return (
        <Select value={value?.toString() || ''} onValueChange={(v) => onChange(v === 'true')}>
          <SelectTrigger>
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );

    default:
      return null;
  }
}

// Helper function to format filter values for display
function formatFilterValue(value: any, type: FilterConfig['type']): string {
  switch (type) {
    case 'date':
      return format(new Date(value), 'PPP');
    case 'daterange':
      if (!value.from) return 'No date';
      if (!value.to) return format(value.from, 'PPP');
      return `${format(value.from, 'PP')} - ${format(value.to, 'PP')}`;
    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
} 