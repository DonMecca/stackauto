# AppSumo Scraper Documentation

## Overview

The AppSumo Scraper is a specialized web scraping solution for extracting software deal listings from AppSumo's website. It's designed to be robust against UI changes, handle pagination efficiently through scrolling and "Show More Results" button interactions, and process listings in batches to provide real-time progress feedback. The scraper is now fully integrated into the main Electron application with a dedicated UI tab and navigation controls.

## Key Components

### Main Classes

- **FocusedScraper**: The primary class that extends EventEmitter for event-driven operation. Focused on extracting core data only (URLs, titles, categories, and thumbnail images).
- **AppSumoListing**: A model class that structures the data for each listing with validation and serialization capabilities.

## Architecture

The scraper follows an event-driven architecture built around Node.js with the following key dependencies:

- **Puppeteer**: For headless browser automation
- **EventEmitter**: For progress reporting and notifications
- **Node.js core modules**: `fs` and `path` for file operations

## Features

### Core Features

1. **Focused Data Extraction**: Extracts only essential listing data:
   - Product URLs
   - Thumbnail images
   - Product names
   - Categories

2. **Event-Driven Progress Reporting**: Emits events for:
   - `scrape:start`: When scraping begins
   - `scrape:progress`: During extraction with detailed status
   - `scrape:complete`: When all listings are extracted
   - `scrape:error`: For error handling

3. **Advanced Pagination Handling**:
   - Dynamic scrolling based on page content
   - Multi-layered "Show More Results" button detection
   - Configurable delays between pagination actions
   - Automatic detection of end-of-listings

4. **Batch Processing**:
   - Process listings in batches after each scroll/click
   - Report new findings in real-time
   - Track stale batches to detect end of content

5. **Robust Error Handling**:
   - Multiple fallback selectors for element detection
   - Recovery from failed button clicks
   - Protection against concurrent scraping operations
   - Resource cleanup in all scenarios

6. **Debug Support**:
   - Screenshot capturing at key points
   - Verbose logging options
   - Detail-rich progress events

## Configuration Options

The `scrapeListings()` method accepts an options object with the following parameters:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxListings` | Number | 20 | Maximum number of listings to extract |
| `maxScrolls` | Number | 3 | Maximum scroll attempts to perform |
| `verbose` | Boolean | false | Enable detailed progress logging |
| `debug` | Boolean | false | Save debug screenshots |
| `paginationDelay` | Number | 2000 | Delay in ms between pagination actions |
| `maxStaleBatches` | Number | 3 | Maximum consecutive batches with no new listings before stopping |
| `processBatches` | Boolean | true | Process listings in batches after each scroll/click |

## Button Detection Strategy

The scraper uses a multi-layered approach to detect and click the "Show More Results" button:

1. **Primary Selectors**: First attempts with standard Puppeteer methods using an array of button selectors:
   ```javascript
   const buttonSelectors = [
     'button:contains("Show More")',
     '[class*="pagination"] button',
     'button.primary',
     'button.more'
   ];
   ```

2. **Page Evaluation Fallback**: If primary selectors fail, uses `page.evaluate()` to run client-side detection:
   - Looks for buttons with text patterns like "Show More", "Load More", etc.
   - Checks button visibility using position and computed style
   - Inspects for pagination-related classes

3. **Multiple Click Methods**: Attempts several techniques to click the button:
   - Standard `click()` method
   - Event dispatch via `MouseEvent`
   - Direct navigation via `href` for link elements

4. **Visual Verification**: With debug mode enabled, takes screenshots before and after clicking to verify the operation.

## Pagination and Scrolling Logic

The scraper combines two pagination mechanisms:

1. **Dynamic Scrolling**:
   - Calculates scroll distance based on content height
   - Tracks scroll position to detect when bottom is reached
   - Uses smooth scrolling for better content loading

2. **Show More Button Interaction**:
   - Detects and clicks "Show More" buttons when available
   - Waits for network activity to settle after clicking
   - Adds configurable delays between actions

## End of Listings Detection

The scraper uses multiple signals to determine when no more listings are available:

1. **Stale Batch Counter**: Tracks consecutive batches that yield no new unique listings
2. **Scroll Position**: Detects when the page bottom is reached and no more content loads
3. **Button Absence**: Recognizes when no "Show More" button can be found
4. **Maximum Limits**: Respects configured maximum listings and scroll attempts

## Batched Processing

The batching system works as follows:

1. Extract initial listings immediately after page load
2. Scroll down or click "Show More" button
3. Extract new listings and filter out duplicates
4. Emit progress event with batch metrics
5. Continue until a termination condition is met

## Error Handling

The scraper implements comprehensive error handling:

1. **Prevention of Concurrent Operations**: Uses `isScraping` flag to prevent multiple parallel scrapes
2. **Failed Button Click Recovery**: Continues with scrolling if button click fails
3. **Network Issues**: Uses timeouts and fallbacks for waiting on network activity
4. **Resource Cleanup**: Always closes browser in a finally block
5. **Detailed Error Events**: Emits `scrape:error` events with error details

## Usage Examples

### Basic Usage

```javascript
const FocusedScraper = require('./services/focusedScraper');

async function run() {
  const scraper = new FocusedScraper();
  
  scraper.on('scrape:start', () => console.log('Scraping started'));
  scraper.on('scrape:progress', (data) => console.log('Progress:', data));
  scraper.on('scrape:complete', (listings) => console.log(`Found ${listings.length} listings`));
  scraper.on('scrape:error', (error) => console.error('Error:', error.message));
  
  try {
    const results = await scraper.scrapeListings();
    console.log('Scraping complete!', results);
  } catch (error) {
    console.error('Scraping failed:', error);
  }
}

run();
```

### Advanced Configuration

```javascript
const results = await scraper.scrapeListings({
  maxListings: 50,
  maxScrolls: 10,
  verbose: true,
  debug: true,
  paginationDelay: 2500,
  maxStaleBatches: 4,
  processBatches: true
});
```

## Debug Screenshots

With debug mode enabled, screenshots are saved at these key points:

1. Initial page load
2. Before attempting to click "Show More" button
3. After clicking "Show More" button
4. During listing extraction

Screenshots are saved to the `output` directory with timestamped filenames.

## Implementation Details

### Extraction Logic

The listing extraction process:

1. Identifies product links on the page
2. For each link, traverses up to find the containing card
3. Extracts title, category, URL, and image URL
4. Creates a structured object for each listing
5. Filters out duplicates based on URL

### HTML Structure Adaptation

The scraper is designed to adapt to AppSumo's HTML structure changes through:

1. Multiple selector pathways for finding elements
2. Content-based detection rather than strict class names
3. Fallback mechanisms for different HTML structures
4. Text pattern matching for elements without consistent selectors

## Performance Considerations

To optimize performance, the scraper:

1. Uses batch processing to avoid extracting the entire page repeatedly
2. Implements efficient duplicate detection
3. Limits screenshot captures to debug mode only
4. Uses race conditions with timeouts to prevent hanging on network operations
5. Processes only visible listings to reduce memory usage

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Show More button not detected | Increase the scroll attempts, as the button may appear after more scrolling |
| Duplicate listings | The scraper automatically filters these using URL comparison |
| Rate limiting | Increase the paginationDelay value to add more time between actions |
| Incomplete data | Check verbose logs for extraction details and adjust selectors if needed |
| Page structure changes | Update the selectors in the FocusedScraper class as needed |

## Testing

The scraper includes:

1. **Live Tests**: Tests actual scraping against the live AppSumo website
2. **Demo Script**: A standalone script to demonstrate and test functionality

## Future Enhancements

Potential areas for future development:

1. **Caching**: Implement local caching to avoid re-scraping recently viewed listings
2. **Deep Detail Extraction**: Add support for extracting more detailed product information
3. **Proxy Support**: Add the ability to use rotating proxies to avoid IP blocking
4. **Image Download**: Add optional downloading of product images
5. **Headless Mode Toggle**: Option to run with visible browser for debugging
6. **Scheduled Scraping**: Support for running the scraper at scheduled intervals

## Maintenance

To keep the scraper functioning properly:

1. **Regular Testing**: Run tests periodically to ensure compatibility with AppSumo's latest UI
2. **Selector Updates**: Update selectors if AppSumo changes their HTML structure
3. **Puppeteer Updates**: Keep Puppeteer updated to the latest compatible version

## Troubleshooting

If the scraper fails:

1. Enable `verbose` and `debug` modes for detailed logs and screenshots
2. Check the screenshots to identify UI changes that might require selector updates
3. Increase `paginationDelay` if rate limiting is suspected
4. Adjust `maxStaleBatches` if the scraper is stopping too early or running too long

## Electron Integration

### User Interface

The AppSumo scraper is fully integrated into the main Electron application with the following features:

1. **Tab Navigation**:
   - The main application includes tabs to switch between Content Workflow and AppSumo Deals
   - A "Browse AppSumo listings" link in the main content form provides quick access to the AppSumo tab

2. **Renderer Script**:
   - A simplified renderer script (`appsumo-renderer-simple.js`) handles UI interactions without Node.js `require`
   - Compatible with Electron's contextIsolation security feature
   - Uses the global window object for communication instead of CommonJS modules

3. **IPC Communication**:
   - All scraper functions are exposed via IPC handlers between main and renderer processes
   - Events for starting/stopping scans, retrieving listings, and updating status
   - Safe access to filesystem for storing and loading scraped listings

4. **Cookie Management**:
   - Shares the cookie management infrastructure with the main application
   - Uses the same UI components for cookie selection and management
   - Securely stores and retrieves cookies for authenticated browsing

### Usage in Electron

To use the AppSumo scraper in the Electron app:

1. Click the "AppSumo Deals" tab or the "Browse AppSumo listings" link in the main form
2. Choose a cookie set from the dropdown (if available) or add new cookies
3. Click "Scan Now" to start scraping AppSumo listings
4. View results in the listings table, which includes product names, categories, and URLs
5. Use the filter controls to narrow down results by category or text search

## Known Limitations

1. Does not extract detailed product descriptions or pricing
2. Not designed to handle user login or authenticated features
3. May require updates if AppSumo significantly changes their UI structure
