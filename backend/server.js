const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const axe = require('axe-core');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Scan endpoint
app.get('/scan', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Add user agent and timeout
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    const { window } = new JSDOM(html, {
      url,
      runScripts: 'outside-only',
      pretendToBeVisual: true
    });

    // Wait for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run axe analysis with more rules
    const results = await axe.run(window.document, {
      reporter: 'v2',
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'best-practice']
      },
      resultTypes: ['violations', 'passes']
    });

    console.log(`Scan completed for ${url}`);
    console.log(`Found ${results.violations.length} violations`);
    console.log(`Passed ${results.passes.length} tests`);

    res.json({
      violations: results.violations.map(v => ({
        ...v,
        nodes: v.nodes.map(node => ({
          ...node,
          target: node.target,
          failureSummary: node.failureSummary
        }))
      })),
      passes: results.passes
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      error: `Failed to analyze website: ${error.message}` 
    });
  }
});

// Analyze endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Parse violations from the prompt more carefully
    let violations = [];
    try {
      const dataStart = prompt.indexOf('Accessibility scan data for');
      const jsonStart = prompt.indexOf('[', dataStart);
      const jsonEnd = prompt.indexOf(']', jsonStart) + 1;
      violations = JSON.parse(prompt.slice(jsonStart, jsonEnd));
    } catch (parseError) {
      console.error('Failed to parse violations:', parseError);
      throw new Error('Invalid accessibility data format');
    }

    if (!Array.isArray(violations)) {
      throw new Error('No violations data found');
    }

    // Count violations by impact
    const impactCounts = violations.reduce((counts, v) => {
      const impact = v.impact || 'minor';
      counts[impact] = (counts[impact] || 0) + 1;
      return counts;
    }, {});

    // Calculate severity and score
    let severity = 'low';
    if (impactCounts.critical > 0) severity = 'high';
    else if (impactCounts.serious > 0) severity = 'medium';
    else if ((impactCounts.moderate || 0) > 2) severity = 'medium';

    const score = Math.max(0, Math.min(100,
      100 - 
      ((impactCounts.critical || 0) * 20) -
      ((impactCounts.serious || 0) * 15) -
      ((impactCounts.moderate || 0) * 10) -
      ((impactCounts.minor || 0) * 5)
    ));

    // Generate specific recommendations
    const recommendations = violations.map(v => {
      const impact = v.impact ? `[${v.impact.toUpperCase()}]` : '';
      const elements = v.nodes?.length > 0 ? ` (${v.nodes.length} elements affected)` : '';
      return `${impact} ${v.description || v.help}${elements}. ${v.nodes?.[0]?.failureSummary || ''}`;
    }).slice(0, 5);

    const report = {
      summary: `Analysis found ${violations.length} accessibility issues: ` +
               `${impactCounts.critical || 0} critical, ` +
               `${impactCounts.serious || 0} serious, ` +
               `${impactCounts.moderate || 0} moderate. ` +
               `This website requires ${severity} priority attention.`,
      recommendations,
      severity,
      score: Math.round(score)
    };

    console.log('Analysis completed:', JSON.stringify(report, null, 2));
    res.json({ report: JSON.stringify(report) });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: `Analysis failed: ${error.message}`,
      details: error.stack
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('- POST /analyze - Analyze accessibility with GPT-4');
  console.log('- GET /scan - Scan website for accessibility issues');
});
