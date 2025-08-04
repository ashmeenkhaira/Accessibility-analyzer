import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, Loader, Globe, BarChart } from 'lucide-react';

const AccessibilityAnalyzer = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const analyzePage = async (url, axeResults) => {
    try {
      const prompt = `
      You're an accessibility expert. Analyze the accessibility scan results for ${url} and generate a JSON response with this exact structure:

      {
        "summary": "A 2-3 sentence summary of the accessibility state",
        "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4", "recommendation 5"],
        "severity": "low|medium|high",
        "score": 75
      }

      Accessibility scan data for ${url}:
      ${JSON.stringify(axeResults.violations, null, 2)}

      Total violations: ${axeResults.violations.length}
      Total affected elements: ${axeResults.violations.reduce((sum, v) => sum + v.nodes.length, 0)}
      Passed tests: ${axeResults.passes.length}

      Provide specific, actionable recommendations based on the actual violations found on this website. Calculate a score from 0-100 where 100 is perfect accessibility.
    `;

      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.report ? JSON.parse(data.report) : await getSimulatedAnalysis(axeResults);

    } catch (error) {
      console.error('Analysis error:', error);
      return await getSimulatedAnalysis(axeResults);
    }
  };

  const getSimulatedAnalysis = async (axeResults) => {
    // Calculate actual severity based on violations
    const totalViolations = axeResults.violations.length;
    const criticalViolations = axeResults.violations.filter(v => v.impact === 'critical').length;
    const seriousViolations = axeResults.violations.filter(v => v.impact === 'serious').length;

    let severity = 'low';
    if (criticalViolations > 0) severity = 'high';
    else if (seriousViolations > 0) severity = 'medium';

    // Generate specific recommendations based on actual violations
    const recommendations = axeResults.violations.map(violation => {
      return `Fix ${violation.impact} issue: ${violation.help} affecting ${violation.nodes.length} elements`;
    }).slice(0, 5);

    // Calculate score based on actual violations and their impact
    const score = Math.max(0, 100 - 
      (criticalViolations * 15) - 
      (seriousViolations * 10) - 
      ((totalViolations - criticalViolations - seriousViolations) * 5)
    );

    return {
      summary: `Analysis found ${totalViolations} accessibility violations (${criticalViolations} critical, ${seriousViolations} serious). The website requires ${severity} priority attention to meet accessibility standards.`,
      recommendations: recommendations.length > 0 ? recommendations : ['No specific violations found to address'],
      severity,
      score: Math.round(score)
    };
  };

  const runAccessibilityCheck = async (url) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:5000/scan?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }

      if (!data || !data.violations) {
        throw new Error('Invalid response from server');
      }

      return data;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch accessibility data. Please try again later.';
      setError(errorMessage);
      console.error('Accessibility check error:', err);
      return {
        violations: [],
        passes: []
      };
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!url) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');
    setReport(null);

    try {
      // Validate URL
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        throw new Error('Please enter a valid URL starting with http:// or https://');
      }

      // Run accessibility check
      const axeResults = await runAccessibilityCheck(url);
      if (!axeResults) {
        throw new Error('Failed to get accessibility results');
      }

      // Get AI analysis
      const llmAnalysis = await analyzePage(url, axeResults);

      // Combine results
      setReport({
        url,
        timestamp: new Date().toISOString(),
        axeResults,
        llmAnalysis,
        totalIssues: axeResults.violations.reduce((sum, violation) => sum + violation.nodes.length, 0)
      });

    } catch (err) {
      setError(err.message || 'An error occurred while analyzing the website');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-500';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-lg shadow-lg">
              <Globe className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Accessibility Analyzer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered analysis to make your websites more accessible for everyone
          </p>
        </div>

        {/* URL Input Card */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-12">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter website URL (e.g., https://example.com)"
                    className="w-full px-5 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg"
                    disabled={loading}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                  {url && !loading && (
                    <XCircle 
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600"
                      onClick={() => setUrl('')}
                    />
                  )}
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !url}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-medium transition-all"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Analyze
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {report && (
          <div className="space-y-8 animate-fadeIn">
            {/* Score Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ScoreCard
                title="Accessibility Score"
                value={`${report.llmAnalysis.score}/100`}
                icon={<BarChart className="h-6 w-6" />}
                color={getScoreColor(report.llmAnalysis.score)}
              />
              <ScoreCard
                title="Issues Found"
                value={report.totalIssues}
                icon={<AlertTriangle className="h-6 w-6" />}
                color="text-red-600"
              />
              <ScoreCard
                title="Tests Passed"
                value={report.axeResults.passes.length}
                icon={<CheckCircle className="h-6 w-6" />}
                color="text-green-600"
              />
            </div>

            {/* Detailed Results */}
            <div className="bg-white rounded-xl shadow-xl p-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Accessibility Report</h2>
              <div className="mb-4">
                <span className="text-gray-500 text-sm">URL:</span>
                <p className="text-gray-800">{report.url}</p>
              </div>
              <div className="mb-4">
                <span className="text-gray-500 text-sm">Analysis Time:</span>
                <p className="text-gray-800">{new Date(report.timestamp).toLocaleString()}</p>
              </div>
              <div className="mb-4">
                <span className="text-gray-500 text-sm">Total Issues:</span>
                <p className={`text-lg font-semibold ${getSeverityColor(report.llmAnalysis.severity)}`}>
                  {report.totalIssues} issues
                </p>
              </div>
              <div className="mb-4">
                <span className="text-gray-500 text-sm">Accessibility Score:</span>
                <p className={`text-3xl font-bold ${getScoreColor(report.llmAnalysis.score)}`}>
                  {report.llmAnalysis.score}
                </p>
              </div>

              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1">
                  {report.llmAnalysis.recommendations.map((rec, index) => (
                    <li key={index} className="text-gray-700">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Score Card Component
const ScoreCard = ({ title, value, icon, color }) => (
  <div className="bg-white rounded-xl shadow-lg p-6 transition-all hover:shadow-xl">
    <div className="flex items-center gap-4 mb-4">
      <div className={`${color} bg-opacity-10 p-3 rounded-lg`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
    </div>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </div>
);

export default AccessibilityAnalyzer;