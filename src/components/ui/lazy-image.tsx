import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  fallback?: React.ReactNode
  loadingClassName?: string
  errorClassName?: string
}

const LazyImage = React.forwardRef<HTMLImageElement, LazyImageProps>(
  ({ 
    src, 
    alt, 
    className, 
    fallback,
    loadingClassName,
    errorClassName,
    ...props 
  }, ref) => {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(false)
    const [isInView, setIsInView] = useState(false)
    const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null)

    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (entry && entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        },
        { threshold: 0.1 }
      )

      if (imgElement) {
        observer.observe(imgElement)
      }

      return () => observer.disconnect()
    }, [imgElement])

    const handleLoad = () => {
      setIsLoading(false)
      setError(false)
    }

    const handleError = () => {
      setIsLoading(false)
      setError(true)
    }

    if (error) {
      return (
        <div 
          className={cn(
            "flex items-center justify-center bg-muted text-muted-foreground",
            errorClassName,
            className
          )}
        >
          {fallback || <span className="text-xs">Erro ao carregar</span>}
        </div>
      )
    }

    return (
      <div className="relative">
        {isLoading && (
          <div 
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-muted animate-pulse",
              loadingClassName
            )}
          />
        )}
        <img
          {...props}
          ref={(node) => {
            setImgElement(node)
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
          }}
          src={isInView ? src : undefined}
          alt={alt}
          className={cn(
            "transition-opacity duration-300",
            isLoading && "opacity-0",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      </div>
    )
  }
)
LazyImage.displayName = "LazyImage"

export { LazyImage }