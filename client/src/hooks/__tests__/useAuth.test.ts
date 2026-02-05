/**
 * useAuth Hook Tests
 * Testing custom authentication hook following TDD principles
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../../_core/hooks/useAuth';

// Mock tRPC client
const mockTrpcClient = {
  auth: {
    me: { useQuery: vi.fn() },
    login: { useMutation: vi.fn() },
    logout: { useMutation: vi.fn() },
  },
};

vi.mock('@/lib/trpc', () => ({
  trpc: mockTrpcClient,
}));

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should start with loading state', () => {
      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set authenticated user when data available', () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        openId: 'test_user_123',
        role: 'user' as const,
      };

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: mockUser,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle authentication error', () => {
      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Auth failed'),
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeDefined();
    });
  });

  describe('Login Functionality', () => {
    it('should login user successfully', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        openId: 'test_user',
        role: 'user' as const,
      };

      const mockLoginMutation = vi.fn().mockResolvedValue({
        success: true,
        user: mockUser,
        token: 'test-token',
      });

      mockTrpcClient.auth.login.useMutation.mockReturnValue({
        mutateAsync: mockLoginMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn().mockResolvedValue({ data: mockUser }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login('testuser');
      });

      await waitFor(() => {
        expect(mockLoginMutation).toHaveBeenCalledWith({ username: 'testuser' });
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should handle login failure', async () => {
      const mockLoginMutation = vi.fn().mockRejectedValue(
        new Error('Login failed')
      );

      mockTrpcClient.auth.login.useMutation.mockReturnValue({
        mutateAsync: mockLoginMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.login('testuser');
        })
      ).rejects.toThrow('Login failed');
    });

    it('should trim whitespace from username', async () => {
      const mockLoginMutation = vi.fn().mockResolvedValue({
        success: true,
        user: { id: 1, name: 'test', openId: 'test', role: 'user' },
      });

      mockTrpcClient.auth.login.useMutation.mockReturnValue({
        mutateAsync: mockLoginMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login('  testuser  ');
      });

      expect(mockLoginMutation).toHaveBeenCalledWith({ username: 'testuser' });
    });
  });

  describe('Logout Functionality', () => {
    it('should logout user successfully', async () => {
      const mockLogoutMutation = vi.fn().mockResolvedValue({ success: true });

      mockTrpcClient.auth.logout.useMutation.mockReturnValue({
        mutateAsync: mockLogoutMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: {
          id: 1,
          name: 'Test User',
          openId: 'test',
          role: 'user',
        },
        isLoading: false,
        refetch: vi.fn().mockResolvedValue({ data: null }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(mockLogoutMutation).toHaveBeenCalled();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });

    it('should handle logout failure gracefully', async () => {
      const mockLogoutMutation = vi.fn().mockRejectedValue(
        new Error('Logout failed')
      );

      mockTrpcClient.auth.logout.useMutation.mockReturnValue({
        mutateAsync: mockLogoutMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: { id: 1, name: 'Test', openId: 'test', role: 'user' },
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.logout();
        })
      ).rejects.toThrow('Logout failed');
    });
  });

  describe('Permission Checks', () => {
    it('should check if user has admin role', () => {
      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: {
          id: 1,
          name: 'Admin User',
          openId: 'admin',
          role: 'admin',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(true);
    });

    it('should return false for non-admin user', () => {
      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: {
          id: 1,
          name: 'Regular User',
          openId: 'user',
          role: 'user',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(false);
    });

    it('should return false when not authenticated', () => {
      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide refetch function', () => {
      const mockRefetch = vi.fn();

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should refetch user data when called', async () => {
      const mockRefetch = vi.fn().mockResolvedValue({
        data: { id: 1, name: 'Refreshed User', openId: 'test', role: 'user' },
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined user data', () => {
      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle concurrent login/logout', async () => {
      // This test ensures proper state management during concurrent operations
      const mockLoginMutation = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          user: { id: 1, name: 'Test', openId: 'test', role: 'user' },
        }), 100))
      );

      const mockLogoutMutation = vi.fn().mockResolvedValue({ success: true });

      mockTrpcClient.auth.login.useMutation.mockReturnValue({
        mutateAsync: mockLoginMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.logout.useMutation.mockReturnValue({
        mutateAsync: mockLogoutMutation,
        isLoading: false,
      });

      mockTrpcClient.auth.me.useQuery.mockReturnValue({
        data: null,
        isLoading: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAuth());

      // Start login and logout almost simultaneously
      const loginPromise = act(async () => {
        await result.current.login('test');
      });

      const logoutPromise = act(async () => {
        await result.current.logout();
      });

      // Both should complete without errors
      await expect(loginPromise).resolves.not.toThrow();
      await expect(logoutPromise).resolves.not.toThrow();
    });
  });
});
