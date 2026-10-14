import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { titleForPath } from '../../lib/pageTitle'

export default function PageTitle() {
  const { pathname, search } = useLocation()
  useEffect(() => { document.title = titleForPath(pathname, search) }, [pathname, search])
  return null
}
