import { Facebook, X, Github, Linkedin, Instagram } from "lucide-react";
import Image from "next/image";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 dark:bg-black shadow-sm text-gray-400 py-6 dark:border-t dark:border-gray-800">
      <div className="container mx-auto px-4 flex flex-wrap justify-center sm:justify-between items-center text-sm">
        <div className="flex items-center space-x-2">
          <Image
            src="/icon.svg"
            alt="Afino Finance"
            width={24}
            height={24}
            className="h-6 w-6"
          />
          <p>&copy; {currentYear} Afino. Todos os direitos reservados.</p>
        </div>
        <div className="flex space-x-4 mt-2 mr-4 sm:mt-0">
          <a href="#" aria-label="Facebook" className="hover:text-gray-300">
            <Facebook className="w-5 h-5" />
          </a>
          <a href="#" aria-label="LinkedIn" className="hover:text-gray-300">
            <Linkedin className="w-5 h-5" />
          </a>
          <a href="#" aria-label="Instagram" className="hover:text-gray-300">
            <Instagram className="w-5 h-5" />
          </a>
          <a href="#" aria-label="X (formerly Twitter)" className="hover:text-gray-300">
            <X className="w-5 h-5" />
          </a>
          <a href="#" aria-label="GitHub" className="hover:text-gray-300">
            <Github className="w-5 h-5" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
