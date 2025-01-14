#!/usr/bin/env node

/**
 * This script updates the Announcement.tsx component with the latest changelog entry.
 * It extracts the content from CHANGELOG.md and updates the announcement component
 * while preserving its structure.
 * 
 * Environment Variables:
 *     VERSION: The version number to extract from changelog
 *     CHANGELOG_PATH: Path to the changelog file (defaults to 'CHANGELOG.md')
 *     ANNOUNCEMENT_PATH: Path to the Announcement.tsx file
 */

const fs = require('fs');
const { compiler } = require('markdown-to-jsx');

const VERSION = process.env.VERSION; // For testing
const CHANGELOG_PATH = process.env.CHANGELOG_PATH || 'CHANGELOG.md';
const ANNOUNCEMENT_PATH = process.env.ANNOUNCEMENT_PATH || 'webview-ui/src/components/chat/Announcement.tsx';

function extractLatestChangelogEntry() {
    const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    
    // Find the section for the specified version
    const versionPattern = `## [${VERSION}]`;
    const nextVersionPattern = '## [';
    
    const startIdx = content.indexOf(versionPattern);
    if (startIdx === -1) {
        throw new Error(`Version ${VERSION} not found in changelog`);
    }
    
    // Find the next version section or end of file
    const endIdx = content.indexOf(nextVersionPattern, startIdx + versionPattern.length);
    
    // Extract and clean up the content
    const entry = content.slice(
        startIdx + versionPattern.length,
        endIdx === -1 ? undefined : endIdx
    ).trim();

    return entry;
}

function convertMarkdownToJsx(markdown) {
    // Custom renderer to handle JSX style props
    function createElement(type, props = {}, ...children) {
        const childContent = children.join('');
        switch (type) {
            case 'p':
                return `<p style={{ margin: "5px 0px" }}>${childContent}</p>`;
            case 'ul':
                return `<ul style={{ margin: "4px 0 6px 20px", padding: 0 }}>${childContent}</ul>`;
            case 'li':
                return `<li>${childContent}</li>`;
            case 'strong':
                return `<b>${childContent}</b>`;
            case 'a':
                return `<VSCodeLink style={{ display: "inline" }} href="${props.href}">${childContent}</VSCodeLink>`;
            default:
                return childContent;
        }
    }

    // Convert markdown to JSX using custom renderer
    let jsx = compiler(markdown, { createElement });

    // Clean up any remaining {" "} artifacts
    jsx = jsx.replace(/\{"\s*"\}/g, ' ');

    // Add proper indentation
    jsx = jsx.split('\n')
        .map(line => '\t\t\t' + line)
        .join('\n');

    return jsx;
}

function updateAnnouncementComponent(changelogEntry) {
    const content = fs.readFileSync(ANNOUNCEMENT_PATH, 'utf8');
    
    // Convert changelog entry to JSX-friendly format
    const formattedContent = convertMarkdownToJsx(changelogEntry).replace('{" "}', "");
    
    // Find and update the version number in h3 tag
    const h3StartMarker = '<h3 style={{ margin: "0 0 8px" }}>';
    const h3EndMarker = '</h3>';
    const h3StartIdx = content.indexOf(h3StartMarker);
    const h3EndIdx = content.indexOf(h3EndMarker);
    
    if (h3StartIdx === -1 || h3EndIdx === -1) {
        throw new Error('Could not find h3 tag in Announcement.tsx');
    }
    
    // Update version in h3
    const updatedH3 = `<h3 style={{ margin: "0 0 8px" }}>🎉{"  "}New in Cline v${VERSION}`;
    
    // Find the content section in Announcement.tsx
    const endMarker = '<div\n\t\t\t\tstyle=';
    
    const endIdx = content.indexOf(endMarker);
    
    if (endIdx === -1) {
        throw new Error('Could not find content section in Announcement.tsx');
    }
    
    // Create the new announcement content with proper spacing
    const newContent = `\n${formattedContent}\t\t\t`;
    
    // Replace both the h3 and content sections while preserving the component structure
    const updatedContent =
        content.slice(0, h3StartIdx) +
        updatedH3 +
        content.slice(h3EndIdx, h3EndIdx + h3EndMarker.length) +
        newContent +
        content.slice(endIdx);
    
    fs.writeFileSync(ANNOUNCEMENT_PATH, updatedContent);
    
    console.log(`Updated ${ANNOUNCEMENT_PATH} with latest changelog entry`);
}

// Run the script
const changelogEntry = extractLatestChangelogEntry();
updateAnnouncementComponent(changelogEntry);