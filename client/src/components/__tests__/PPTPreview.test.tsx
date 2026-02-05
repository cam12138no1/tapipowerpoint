/**
 * PPTPreview Component Tests
 * Following TDD and SDD principles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PPTPreview from '../PPTPreview';

// Note: Setup @testing-library/react in package.json first:
// npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

describe('PPTPreview Component', () => {
  const mockTask = {
    id: 1,
    title: 'Test Presentation',
    status: 'completed' as const,
    progress: 100,
    currentStep: 'Completed',
    resultPptxUrl: 'https://example.com/test.pptx',
    resultPdfUrl: 'https://example.com/test.pdf',
    project: {
      id: 1,
      name: 'Test Project',
      primaryColor: '#0033A0',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render task title', () => {
      render(<PPTPreview task={mockTask} />);
      expect(screen.getByText('Test Presentation')).toBeInTheDocument();
    });

    it('should show project name when available', () => {
      render(<PPTPreview task={mockTask} />);
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should show progress bar at 100%', () => {
      render(<PPTPreview task={mockTask} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('should render without project', () => {
      const taskWithoutProject = { ...mockTask, project: null };
      render(<PPTPreview task={taskWithoutProject} />);
      expect(screen.getByText('Test Presentation')).toBeInTheDocument();
    });
  });

  describe('Download Actions', () => {
    it('should show download PPTX button when URL available', () => {
      render(<PPTPreview task={mockTask} />);
      expect(screen.getByText(/Download PPTX/i)).toBeInTheDocument();
    });

    it('should show download PDF button when URL available', () => {
      render(<PPTPreview task={mockTask} />);
      expect(screen.getByText(/Download PDF/i)).toBeInTheDocument();
    });

    it('should hide download buttons when URLs not available', () => {
      const taskWithoutFiles = {
        ...mockTask,
        resultPptxUrl: null,
        resultPdfUrl: null,
      };
      render(<PPTPreview task={taskWithoutFiles} />);
      expect(screen.queryByText(/Download PPTX/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Download PDF/i)).not.toBeInTheDocument();
    });

    it('should trigger download on PPTX button click', async () => {
      const mockDownload = vi.fn();
      global.open = mockDownload;

      render(<PPTPreview task={mockTask} />);
      const downloadBtn = screen.getByText(/Download PPTX/i);
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith(mockTask.resultPptxUrl);
      });
    });
  });

  describe('Status Display', () => {
    it('should show pending status correctly', () => {
      const pendingTask = { ...mockTask, status: 'pending' as const, progress: 0 };
      render(<PPTPreview task={pendingTask} />);
      expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    });

    it('should show running status with progress', () => {
      const runningTask = {
        ...mockTask,
        status: 'running' as const,
        progress: 50,
        currentStep: 'Generating slides...',
      };
      render(<PPTPreview task={runningTask} />);
      expect(screen.getByText(/Generating slides.../i)).toBeInTheDocument();
      expect(screen.getByText(/50%/i)).toBeInTheDocument();
    });

    it('should show failed status with error message', () => {
      const failedTask = {
        ...mockTask,
        status: 'failed' as const,
        errorMessage: 'Generation failed',
      };
      render(<PPTPreview task={failedTask} />);
      expect(screen.getByText(/Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
    });

    it('should show ask status for user interaction', () => {
      const askTask = {
        ...mockTask,
        status: 'ask' as const,
        currentStep: 'Waiting for confirmation',
      };
      render(<PPTPreview task={askTask} />);
      expect(screen.getByText(/Waiting for confirmation/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<PPTPreview task={mockTask} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', () => {
      render(<PPTPreview task={mockTask} />);
      const downloadBtn = screen.getByText(/Download PPTX/i);
      downloadBtn.focus();
      expect(downloadBtn).toHaveFocus();
    });

    it('should have alt text for images', () => {
      render(<PPTPreview task={mockTask} />);
      const images = screen.queryAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long task titles', () => {
      const longTitleTask = {
        ...mockTask,
        title: 'A'.repeat(200),
      };
      render(<PPTPreview task={longTitleTask} />);
      expect(screen.getByText(/A+/)).toBeInTheDocument();
    });

    it('should handle missing data gracefully', () => {
      const minimalTask = {
        id: 1,
        title: 'Test',
        status: 'pending' as const,
        progress: 0,
        currentStep: '',
      };
      expect(() => render(<PPTPreview task={minimalTask as any} />)).not.toThrow();
    });

    it('should handle progress values outside 0-100', () => {
      const invalidProgressTask = { ...mockTask, progress: 150 };
      render(<PPTPreview task={invalidProgressTask} />);
      // Should clamp to 100
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });
  });
});
