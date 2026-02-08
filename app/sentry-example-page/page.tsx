"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SentryExampleFrontendError } from "@/lib/sentry-errors"

export default function SentryExamplePage() {
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    console.log('Sentry example page loaded')
  }, [])

  // Function to call the backend API that will throw an error
  const callExampleAPI = async () => {
    setApiStatus('loading')
    setErrorMessage('')
    
    try {
      console.log('Fetching Sentry example API...')
      const response = await fetch('/api/sentry-example-api')
      
      if (!response.ok) {
        const errorText = await response.text()
        setApiStatus('error')
        setErrorMessage(errorText || 'API returned an error')
      } else {
        setApiStatus('idle')
      }
    } catch (error) {
      setApiStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  // Function to throw a frontend error
  const throwFrontendError = () => {
    console.log('User clicked the button, throwing a sample error')
    
    // Call the API first to trigger backend error
    callExampleAPI().catch((err) => {
      console.error('API call failed:', err)
    })
    
    // Then throw the frontend error
    throw new SentryExampleFrontendError(
      "This error is raised on the frontend of the example page.",
    )
  }

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Sentry Error Example Page</CardTitle>
          <CardDescription>
            This page demonstrates error tracking with Sentry. Click the button below to trigger
            both a frontend error and a backend API error.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              When you click the button:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>A fetch request will be made to <code className="bg-muted px-1 py-0.5 rounded">/api/sentry-example-api</code></li>
              <li>The API will throw a <code className="bg-muted px-1 py-0.5 rounded">SentryExampleAPIError</code></li>
              <li>The frontend will throw a <code className="bg-muted px-1 py-0.5 rounded">SentryExampleFrontendError</code></li>
              <li>Both errors will be captured by Sentry (if configured)</li>
            </ul>
          </div>

          {apiStatus === 'error' && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                API Error Occurred:
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {errorMessage}
              </p>
            </div>
          )}

          <Button 
            onClick={throwFrontendError}
            variant="destructive"
            size="lg"
            disabled={apiStatus === 'loading'}
            className="w-full"
          >
            <span>
              {apiStatus === 'loading' ? 'Triggering Errors...' : 'Trigger Sentry Example Errors'}
            </span>
          </Button>

          <p className="text-xs text-muted-foreground italic">
            Note: This is a demonstration page for Sentry error tracking. The errors are intentional.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
